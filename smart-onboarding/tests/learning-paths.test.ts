import { describe, expect, it } from "vitest";
import {
  assignmentId,
  buildLearningPath,
  checkpointDueDate,
  createAssignments,
  reconcileAssignments,
} from "@/lib/learning";
import { LEARNING_DISCLAIMER, LEARNING_MODULES } from "@/lib/learning-catalog";
import { LEARNING_MODULE_IDS } from "@/types/learning";
import type { WorkflowContext } from "@/types/onboarding";
import { makeCase } from "./helpers";

const OFFICE: WorkflowContext = { workArrangement: "Office", peopleManager: false, internationalHire: false };
const REMOTE: WorkflowContext = { ...OFFICE, workArrangement: "Remote" };

const summary = (context: WorkflowContext) =>
  buildLearningPath(context).map((e) => `${e.moduleId}:${e.mandatory ? "M" : "o"}:${e.checkpoint}`);

describe("catalog", () => {
  it("contains the five original modules", () => {
    expect(LEARNING_MODULES.map((m) => m.title)).toEqual([
      "Company Culture & Values",
      "Data Protection Essentials",
      "Workplace Health & Safety",
      "Remote Working Essentials",
      "Leading Your New Team",
    ]);
    expect(LEARNING_MODULES.map((m) => m.id)).toEqual([...LEARNING_MODULE_IDS]);
    expect(LEARNING_DISCLAIMER).toBe("Illustrative content — not certified compliance training");
  });

  it("has well-formed lessons and quizzes", () => {
    for (const m of LEARNING_MODULES) {
      expect(m.lessons.length).toBeGreaterThan(0);
      expect(new Set(m.lessons.map((l) => l.id)).size).toBe(m.lessons.length);
      for (const l of m.lessons) {
        expect(l.body.length).toBeGreaterThan(0);
        expect(l.keyPoints.length).toBeGreaterThan(0);
      }
      if (!m.quiz) continue;
      expect(m.quiz.passMark).toBeGreaterThan(0);
      expect(m.quiz.passMark).toBeLessThanOrEqual(100);
      for (const q of m.quiz.questions) {
        expect(q.options.map((o) => o.id)).toContain(q.correctOptionId);
        expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
        expect(q.explanation.length).toBeGreaterThan(0);
      }
    }
    // One module shows the "lessons only" completion rule.
    expect(LEARNING_MODULES.filter((m) => !m.quiz).map((m) => m.id)).toEqual(["remote-working"]);
  });

  it("makes no certification or legal-compliance claims", () => {
    const text = JSON.stringify(LEARNING_MODULES);
    expect(text).not.toMatch(/\b(certified|certificate|accredited|legally compliant|you are now compliant)\b/i);
  });
});

describe("learning path assignment", () => {
  it("gives every office employee the core modules plus optional remote working", () => {
    expect(summary(OFFICE)).toEqual([
      "culture-values:M:day-7",
      "health-safety:M:day-7",
      "data-protection:M:day-30",
      "remote-working:o:day-90",
    ]);
  });

  it("makes remote working mandatory by Day 30 for remote employees", () => {
    expect(summary(REMOTE)).toContain("remote-working:M:day-30");
    expect(summary(REMOTE)).not.toContain("remote-working:o:day-90");
  });

  it("adds the manager module for people managers only", () => {
    expect(summary({ ...OFFICE, peopleManager: true })).toContain("leading-new-team:M:day-60");
    expect(summary(OFFICE).some((s) => s.startsWith("leading-new-team"))).toBe(false);
    expect(summary({ ...REMOTE, peopleManager: true })).toHaveLength(5);
  });

  it("does not change the path for international hires", () => {
    expect(summary({ ...OFFICE, internationalHire: true })).toEqual(summary(OFFICE));
  });

  it("uses all four checkpoints across the contexts", () => {
    const used = new Set(
      [OFFICE, REMOTE, { ...OFFICE, peopleManager: true }].flatMap((c) => buildLearningPath(c).map((e) => e.checkpoint)),
    );
    expect([...used].sort()).toEqual(["day-30", "day-60", "day-7", "day-90"]);
  });
});

describe("due dates", () => {
  it("are the start date plus 7, 30, 60 or 90 days", () => {
    expect(checkpointDueDate("2026-11-02", "day-7")).toBe("2026-11-09");
    expect(checkpointDueDate("2026-11-02", "day-30")).toBe("2026-12-02");
    expect(checkpointDueDate("2026-11-02", "day-60")).toBe("2027-01-01");
    expect(checkpointDueDate("2026-11-02", "day-90")).toBe("2027-01-31");
  });

  it("handle month ends, year ends and leap years", () => {
    expect(checkpointDueDate("2027-12-28", "day-7")).toBe("2028-01-04");
    expect(checkpointDueDate("2028-02-01", "day-30")).toBe("2028-03-02"); // 2028 is a leap year
    expect(checkpointDueDate("2027-02-01", "day-30")).toBe("2027-03-03");
  });

  it("are set on each new assignment, with no progress", () => {
    const c = { ...makeCase(5, []), id: "c1", startDate: "2026-11-02" };
    const assignments = createAssignments(c);
    expect(assignments.map((a) => [a.id, a.dueDate])).toEqual([
      [assignmentId("c1", "culture-values"), "2026-11-09"],
      [assignmentId("c1", "health-safety"), "2026-11-09"],
      [assignmentId("c1", "data-protection"), "2026-12-02"],
      [assignmentId("c1", "remote-working"), "2027-01-31"],
    ]);
    expect(assignments.every((a) => a.viewedLessonIds.length === 0 && a.quizResults.length === 0 && !a.completedAt)).toBe(
      true,
    );
  });
});

describe("reconcileAssignments", () => {
  const a = makeCase(0, [], "a");
  const b = makeCase(0, [], "b");

  it("adds paths for new cases and drops assignments of deleted cases, keeping progress", () => {
    const existing = createAssignments(a).map((x, i) => (i === 0 ? { ...x, viewedLessonIds: ["values"] } : x));
    const next = reconcileAssignments([a, b], existing);
    expect(next.filter((x) => x.caseId === "b")).toHaveLength(4);
    expect(next.find((x) => x.id === existing[0].id)!.viewedLessonIds).toEqual(["values"]);
    expect(reconcileAssignments([b], next).every((x) => x.caseId === "b")).toBe(true);
  });

  it("returns the same array when nothing changes", () => {
    const existing = createAssignments(a);
    expect(reconcileAssignments([a], existing)).toBe(existing);
  });
});
