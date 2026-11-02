import { describe, expect, it } from "vitest";
import { assessReadiness, countByReadiness, getCriticalTasks, type RuleId } from "@/lib/readiness";
import { createSeedCases } from "@/lib/seed-data";
import { makeCase, TODAY } from "./helpers";

function failedRules(assessment: ReturnType<typeof assessReadiness>): RuleId[] {
  return assessment.rules.filter((r) => !r.passed).map((r) => r.id);
}

// Day 1 is 20 days away unless stated otherwise, so nothing is "due soon" by default.
describe("readiness status rules", () => {
  it("is Ready when every mandatory task for the next milestone is completed", () => {
    const c = makeCase(20, [
      { key: "a", status: "Completed", dueIn: -1 },
      { key: "b", stage: "Day 1", status: "Completed", dueIn: 1 },
      { key: "later", stage: "First 30 days", dueIn: 50 },
    ]);
    const a = assessReadiness(c, TODAY);
    expect(a.status).toBe("Ready");
    expect(a.milestone?.label).toBe("Day 1");
    expect(a.reasons).toEqual([]);
    expect(failedRules(a)).toEqual([]);
    expect(a.requiredCompleted).toBe(2);
  });

  it("ignores optional tasks, even when they are overdue or blocked", () => {
    const c = makeCase(20, [
      { key: "a", status: "Completed", dueIn: -1 },
      { key: "opt1", mandatory: false, dueIn: -5 },
      { key: "opt2", mandatory: false, status: "Blocked", dueIn: 2 },
    ]);
    expect(assessReadiness(c, TODAY).status).toBe("Ready");
  });

  it("is On track when mandatory work is open but nothing is due within 7 days", () => {
    const c = makeCase(20, [{ key: "a", dueIn: 12 }]);
    const a = assessReadiness(c, TODAY);
    expect(a.status).toBe("On track");
    expect(failedRules(a)).toEqual(["milestone-complete"]);
  });

  it("is At risk when a mandatory task is due within 7 days", () => {
    const c = makeCase(20, [{ key: "a", dueIn: 3, status: "In progress" }]);
    const a = assessReadiness(c, TODAY);
    expect(a.status).toBe("At risk");
    expect(a.reasons).toMatchObject([{ kind: "due-soon", severity: "warning", taskId: "c--a" }]);
    expect(a.reasons[0].message).toContain("due in 3 days");
  });

  it("is At risk when an in-progress task waits on an unresolved prerequisite", () => {
    const c = makeCase(20, [
      { key: "prep", dueIn: 12 },
      { key: "next", dueIn: 14, status: "In progress", dependsOn: ["prep"] },
    ]);
    const a = assessReadiness(c, TODAY);
    expect(a.status).toBe("At risk");
    expect(failedRules(a)).toContain("prerequisites-resolved");
    expect(a.reasons).toMatchObject([
      { kind: "waiting-on-prerequisite", taskId: "c--next", relatedTaskIds: ["c--prep"] },
    ]);
  });

  it("reports a due-soon task with an open prerequisite once, as a dependency problem", () => {
    const c = makeCase(20, [
      { key: "prep", dueIn: 12 },
      { key: "next", dueIn: 4, dependsOn: ["prep"] },
    ]);
    const kinds = assessReadiness(c, TODAY).reasons.map((r) => r.kind);
    expect(kinds).toEqual(["waiting-on-prerequisite"]);
  });

  it("is Not ready when a mandatory task is overdue", () => {
    const c = makeCase(20, [{ key: "a", dueIn: -2 }]);
    const a = assessReadiness(c, TODAY);
    expect(a.status).toBe("Not ready");
    expect(failedRules(a)).toContain("no-overdue");
    expect(a.reasons[0]).toMatchObject({ kind: "overdue", severity: "critical" });
    expect(a.reasons[0].message).toContain("2 days overdue");
  });

  it("is Not ready when a mandatory task is blocked, and names the downstream impact", () => {
    const c = makeCase(20, [
      { key: "laptop", status: "Blocked", dueIn: 10, blockedReason: "Supplier delay" },
      { key: "access", dueIn: 15, dependsOn: ["laptop"] },
      { key: "check", dueIn: 18, dependsOn: ["access"] },
    ]);
    const a = assessReadiness(c, TODAY);
    expect(a.status).toBe("Not ready");
    const blocked = a.reasons.find((r) => r.kind === "blocked")!;
    expect(blocked.message).toContain("Supplier delay");
    expect(blocked.message).toContain("2 downstream tasks");
    expect(blocked.relatedTaskIds.sort()).toEqual(["c--access", "c--check"]);
  });

  it("is Not ready when a milestone is due today with mandatory work open", () => {
    const c = makeCase(0, [{ key: "welcome", stage: "Day 1", dueIn: 0 }]);
    const a = assessReadiness(c, TODAY);
    expect(a.status).toBe("Not ready");
    expect(failedRules(a)).toContain("no-due-milestone-open");
    expect(a.reasons.some((r) => r.kind === "milestone-due" && r.message.startsWith("Day 1 is today"))).toBe(true);
    // Not overdue yet: the task is due today.
    expect(a.reasons.some((r) => r.kind === "overdue")).toBe(false);
  });

  it("reports a missed earlier milestone while assessing the next one", () => {
    const c = makeCase(-40, [
      { key: "late", stage: "First 30 days", dueIn: -10, status: "In progress" },
      { key: "sixty", stage: "Day 60", dueIn: 20 },
    ]);
    const a = assessReadiness(c, TODAY);
    expect(a.milestone?.label).toBe("Day 60");
    expect(a.status).toBe("Not ready");
    expect(a.reasons.find((r) => r.kind === "milestone-due")?.message).toMatch(/^Day 30 was due/);
  });

  it("puts critical rules before warnings", () => {
    const c = makeCase(20, [
      { key: "blocked", status: "Blocked", dueIn: 12 },
      { key: "soon", dueIn: 2 },
    ]);
    const a = assessReadiness(c, TODAY);
    expect(a.status).toBe("Not ready");
    expect(a.reasons.map((r) => r.severity)).toEqual(["critical", "warning"]);
  });

  it("is Ready with no milestone once every milestone is reached", () => {
    const c = makeCase(-100, [
      { key: "a", status: "Completed", dueIn: -110 },
      { key: "z", stage: "Day 90", status: "Completed", dueIn: -10 },
    ]);
    const a = assessReadiness(c, TODAY);
    expect(a.status).toBe("Ready");
    expect(a.milestone).toBeNull();
    expect(a.headline).toMatch(/onboarding complete/);
  });

  it("always reports the full, ordered rule checklist", () => {
    const a = assessReadiness(makeCase(20, [{ key: "a" }]), TODAY);
    expect(a.rules.map((r) => r.id)).toEqual([
      "no-overdue",
      "no-blocked",
      "no-due-milestone-open",
      "no-due-soon",
      "prerequisites-resolved",
      "completion-order",
      "milestone-complete",
    ]);
    expect(a.rules.map((r) => r.failsTo)).toEqual([
      "Not ready",
      "Not ready",
      "Not ready",
      "At risk",
      "At risk",
      "At risk",
      "On track",
    ]);
  });
});

describe("mandatory prerequisites", () => {
  it("does not count a completed task whose mandatory prerequisite is open", () => {
    const c = makeCase(20, [
      { key: "account", dueIn: 12 },
      { key: "access", dueIn: 14, status: "Completed", dependsOn: ["account"] },
    ]);
    const a = assessReadiness(c, TODAY);
    expect(a.status).toBe("At risk");
    expect(a.requiredCompleted).toBe(0);
    expect(a.reasons.map((r) => r.kind)).toEqual(["completed-before-prerequisite"]);
  });

  it("includes mandatory prerequisites from earlier stages in the required set", () => {
    const c = makeCase(-20, [
      { key: "pre", stage: "Pre-boarding", status: "Completed", dueIn: -25 },
      { key: "base", stage: "Day 1", status: "Completed", dueIn: -20 },
      { key: "checkin", stage: "First 30 days", dueIn: 10, dependsOn: ["base"] },
    ]);
    const a = assessReadiness(c, TODAY);
    expect(a.milestone?.label).toBe("Day 30");
    expect(a.requiredTasks.map((t) => t.templateKey).sort()).toEqual(["base", "checkin"]);
  });
});

describe("seed data readiness", () => {
  const seed = createSeedCases(TODAY);
  const status = Object.fromEntries(seed.map((c) => [c.employeeName, assessReadiness(c, TODAY).status]));

  it("covers every readiness status with explainable reasons", () => {
    expect(status).toEqual({
      "Maya Lindqvist": "Not ready",
      "Daniel Okafor": "Not ready",
      "Sofia Marin": "Not ready",
      "Tomás Herrera": "At risk",
      "Aiko Tanaka": "On track",
      "Lena Fischer": "Ready",
      "Rafael Costa": "Ready",
      "Marcus Bell": "At risk",
      "Inês Duarte": "Ready",
      "Noah Adeyemi": "On track",
    });
    for (const c of seed) {
      const a = assessReadiness(c, TODAY);
      if (a.status === "Not ready" || a.status === "At risk") expect(a.reasons.length).toBeGreaterThan(0);
    }
  });

  it("explains Maya's blocked equipment and its downstream effect", () => {
    const maya = seed.find((c) => c.employeeName === "Maya Lindqvist")!;
    const blocked = assessReadiness(maya, TODAY).reasons.find((r) => r.kind === "blocked")!;
    expect(blocked.message).toContain("Prepare laptop and equipment");
    expect(blocked.message).toContain("back-order");
    expect(blocked.relatedTaskIds).toContain("demo-maya-lindqvist--confirm-access");
  });

  it("counts readiness across cases", () => {
    expect(countByReadiness(seed, TODAY)).toEqual({ "Not ready": 3, "At risk": 2, "On track": 2, Ready: 3 });
  });

  it("lists critical outstanding tasks, critical first, mandatory only", () => {
    const items = getCriticalTasks(seed, TODAY);
    expect(items.every((i) => i.task.mandatory && i.task.status !== "Completed")).toBe(true);
    const firstWarning = items.findIndex((i) => i.severity === "warning");
    expect(items.slice(firstWarning).every((i) => i.severity === "warning")).toBe(true);
    const keys = items.filter((i) => i.severity === "critical").map((i) => `${i.employeeName}:${i.task.templateKey}`);
    expect(keys).toEqual(
      expect.arrayContaining([
        "Maya Lindqvist:equipment",
        "Maya Lindqvist:confirm-access", // held up by the blocked equipment task
        "Daniel Okafor:confirm-access",
        "Sofia Marin:feedback-checkin",
      ]),
    );
  });
});
