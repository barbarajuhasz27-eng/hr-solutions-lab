import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  getBlockerPatterns,
  getCompletionByStage,
  getDay1Readiness,
  getHandoverSummary,
  getOverdueByOwner,
  getReadinessMix,
  getStakeholderDistribution,
  KPI_DEFINITIONS,
} from "@/lib/process-intelligence";
import { createSeedCases } from "@/lib/seed-data";
import { makeCase, TODAY } from "./helpers";

describe("Day 1 readiness rate", () => {
  it("counts started cases whose mandatory Day 1 work was done by the start date", () => {
    const ready = makeCase(-10, [
      { key: "a", status: "Completed", dueIn: -15 },
      { key: "opt", mandatory: false, dueIn: -12 }, // optional work never counts
      { key: "b", stage: "Day 1", status: "Completed", dueIn: -10 },
    ], "ready");
    const late = makeCase(-10, [
      { key: "a", status: "Completed", dueIn: -15, completedAt: addDays(TODAY, -8) }, // after start
    ], "late");
    const open = makeCase(-5, [{ key: "a", dueIn: -8, status: "In progress" }], "open");
    const future = makeCase(10, [{ key: "a", dueIn: 5 }], "future"); // not started: excluded

    const result = getDay1Readiness([ready, late, open, future], TODAY);
    expect(result).toMatchObject({ eligible: 3, ready: 1, rate: 33 });
    expect(result.notReadyCases.map((c) => c.caseId)).toEqual(["late", "open"]);
  });

  it("returns null when no case has started", () => {
    expect(getDay1Readiness([makeCase(5, [{ key: "a" }])], TODAY).rate).toBeNull();
  });
});

describe("completion by stage", () => {
  it("only counts tasks that are already due", () => {
    const c = makeCase(-5, [
      { key: "a", status: "Completed", dueIn: -10 },
      { key: "b", dueIn: -1 },
      { key: "c", dueIn: 5 }, // not due yet
      { key: "d", stage: "Day 90", dueIn: 85 },
    ]);
    const [pre, , , , day90] = getCompletionByStage([c], TODAY);
    expect(pre).toMatchObject({ totalTasks: 3, dueTasks: 2, dueCompleted: 1, rate: 50 });
    expect(day90).toMatchObject({ totalTasks: 1, dueTasks: 0, rate: null });
  });
});

describe("overdue tasks by owner", () => {
  it("counts open overdue tasks per owner and never completed ones", () => {
    const c = makeCase(-5, [
      { key: "a", owner: "IT", dueIn: -3 },
      { key: "b", owner: "IT", dueIn: -2, status: "Blocked" },
      { key: "c", owner: "IT", dueIn: 4 },
      { key: "d", owner: "HR", dueIn: -9, status: "Completed" },
    ]);
    const rows = getOverdueByOwner([c], TODAY);
    expect(rows[0]).toMatchObject({ owner: "IT", overdue: 2, open: 3, overdueShare: 67 });
    expect(rows.find((r) => r.owner === "HR")).toMatchObject({ overdue: 0, open: 0, overdueShare: null });
  });
});

describe("handover delays", () => {
  const c = makeCase(-5, [
    // HR → IT, prerequisite finished 3 days late
    { key: "docs", owner: "HR", dueIn: -10, status: "Completed", completedAt: addDays(TODAY, -7) },
    { key: "account", owner: "IT", dueIn: -6, status: "Completed", dependsOn: ["docs"] },
    // IT → IT: same team, not a handover
    { key: "access", owner: "IT", dueIn: -4, status: "Completed", dependsOn: ["account"] },
    // Finance → HR, prerequisite still open and 2 days overdue
    { key: "payroll", owner: "Finance / Payroll", dueIn: -2 },
    { key: "confirm", owner: "HR", dueIn: 3, dependsOn: ["payroll"] },
    // HR → Facilities, on time
    { key: "brief", owner: "HR", dueIn: -3, status: "Completed" },
    { key: "desk", owner: "Facilities", dueIn: -1, dependsOn: ["brief"] },
    // Not due yet: excluded
    { key: "future", owner: "HR", dueIn: 4 },
    { key: "after", owner: "IT", dueIn: 6, dependsOn: ["future"] },
  ]);

  it("measures cross-team handovers whose prerequisite is due", () => {
    const summary = getHandoverSummary([c], TODAY);
    expect(summary).toMatchObject({ evaluated: 3, delayed: 2, ongoing: 1, averageDelayDays: 2.5 });
    expect(summary.delayedHandovers.map((h) => [h.from, h.to, h.delayDays, h.ongoing])).toEqual([
      ["HR", "IT", 3, false],
      ["Finance / Payroll", "HR", 2, true],
    ]);
    expect(summary.routes.find((r) => r.route === "HR → Facilities")).toMatchObject({ handovers: 1, delayed: 0 });
  });
});

describe("recurring blockers", () => {
  it("flags task types blocked in two or more cases, including past blocks", () => {
    const one = makeCase(10, [
      { key: "laptop", status: "Blocked", blockedReason: "Back-order" },
      { key: "badge", blockedCount: 1, status: "Completed", dueIn: -1 },
    ], "one", "Alex");
    const two = makeCase(10, [{ key: "laptop", status: "Completed", dueIn: -1, blockedCount: 2, blockedReason: "Courier" }], "two", "Sam");
    const patterns = getBlockerPatterns([one, two]);
    expect(patterns[0]).toMatchObject({
      templateKey: "laptop",
      casesAffected: 2,
      currentlyBlocked: 1,
      recurring: true,
      reasons: ["Back-order", "Courier"],
      employees: ["Alex", "Sam"],
    });
    expect(patterns[1]).toMatchObject({ templateKey: "badge", recurring: false });
  });
});

describe("task distribution", () => {
  it("shares add up to the whole and are sorted by size", () => {
    const seed = createSeedCases(TODAY);
    const rows = getStakeholderDistribution(seed, TODAY);
    const total = seed.reduce((n, c) => n + c.tasks.length, 0);
    expect(rows.reduce((n, r) => n + r.total, 0)).toBe(total);
    expect(rows.map((r) => r.total)).toEqual([...rows.map((r) => r.total)].sort((a, b) => b - a));
    expect(rows.every((r) => r.open + r.completed === r.total)).toBe(true);
  });
});

describe("seed dataset KPIs", () => {
  const seed = createSeedCases(TODAY);

  it("derives every KPI from the synthetic cases", () => {
    expect(getDay1Readiness(seed, TODAY)).toMatchObject({ eligible: 6, ready: 4, rate: 67 });
    expect(getReadinessMix(seed, TODAY)).toEqual({ "Not ready": 3, "At risk": 2, "On track": 2, Ready: 1 });
    expect(getHandoverSummary(seed, TODAY)).toMatchObject({ evaluated: 24, delayed: 4 });
    expect(getBlockerPatterns(seed).filter((b) => b.recurring).map((b) => b.templateKey)).toEqual([
      "equipment",
      "account-provisioning",
    ]);
  });

  it("documents every KPI", () => {
    for (const definition of Object.values(KPI_DEFINITIONS)) expect(definition.length).toBeGreaterThan(40);
  });
});
