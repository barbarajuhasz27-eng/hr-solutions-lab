import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  actionClosureRate,
  checkInCompletion,
  EXPERIENCE_KPI_DEFINITIONS,
  feedbackParticipation,
  getBottlenecks,
  getCheckInGaps,
  getCheckInReport,
  getExecutiveOverview,
  getExperienceTrends,
  getLearningByCheckpoint,
  getLearningModuleReport,
  getParticipationByCheckpoint,
  MIN_GROUP_SIZE,
  overdueActions,
  rate,
  readinessRate,
} from "@/lib/experience";
import { EMPTY_FEEDBACK, submitSurvey } from "@/lib/feedback";
import { createSeedFeedback } from "@/lib/feedback-seed";
import { createSeedLearning } from "@/lib/learning-seed";
import { createSeedCases } from "@/lib/seed-data";
import type { ActionItem, FeedbackState, Meeting, SurveyResponse } from "@/types/feedback";
import type { OnboardingCase } from "@/types/onboarding";
import { makeCase, TODAY } from "./helpers";

const cases = createSeedCases(TODAY);
const feedback = createSeedFeedback(cases, TODAY);
const learning = createSeedLearning(cases, TODAY);
const DANIEL = cases.find((c) => c.id === "demo-daniel-okafor")!;
const allFours = { "role-clarity": 4, "learning-development": 4, "manager-support": 4, "team-integration": 4, "tools-resources": 4 };

function meeting(id: string, caseId: string, dateIn: number, status: Meeting["status"], outcome?: string): Meeting {
  return {
    id,
    caseId,
    type: "hr",
    slotId: id,
    hostName: "Host",
    date: addDays(TODAY, dateIn),
    time: "10:00",
    durationMinutes: 30,
    status,
    bookedAt: addDays(TODAY, -20),
    agenda: [],
    ...(outcome ? { outcome, completedAt: addDays(TODAY, dateIn) } : {}),
  };
}

function action(id: string, caseId: string, status: ActionItem["status"], dueIn: number, reopenCount = 0): ActionItem {
  return {
    id,
    caseId,
    description: `Action ${id}`,
    owner: "HR",
    dueDate: addDays(TODAY, dueIn),
    status,
    source: { kind: "topic", topicId: "t" },
    createdAt: addDays(TODAY, -10),
    reopenCount,
    followUps: [],
    history: [],
  } as ActionItem;
}

function response(caseId: string, checkpoint: SurveyResponse["checkpoint"], value: number, comment?: string): SurveyResponse {
  const ratings = Object.fromEntries(Object.keys(allFours).map((a) => [a, value])) as SurveyResponse["ratings"];
  return { id: `${caseId}-${checkpoint}`, caseId, checkpoint, submittedAt: TODAY, ratings, ...(comment ? { comment } : {}) };
}

const fbWith = (patch: Partial<FeedbackState>): FeedbackState => ({ ...EMPTY_FEEDBACK, ...patch });
const someCases = (n: number): OnboardingCase[] => Array.from({ length: n }, (_, i) => makeCase(-100, [{ key: "a", status: "Completed", dueIn: -50 }], `c${i}`, `Person ${i}`));

describe("rate", () => {
  it("returns null for a zero denominator, never NaN or Infinity", () => {
    expect(rate(0, 0)).toEqual({ numerator: 0, denominator: 0, percent: null });
    expect(rate(1, 3).percent).toBe(33);
  });
});

describe("Executive KPIs on the demo data", () => {
  it("computes every headline figure from the seed", () => {
    const o = getExecutiveOverview(cases, learning, feedback, TODAY);
    expect(o.readiness).toMatchObject({ numerator: 3, denominator: 8, percent: 38 });
    expect(o.mandatoryLearning).toEqual({ numerator: 14, denominator: 16, percent: 88 });
    expect(o.checkInCompletion).toEqual({ numerator: 3, denominator: 3, percent: 100 });
    expect(o.feedbackParticipation).toEqual({ numerator: 12, denominator: 14, percent: 86 });
    expect(o.actionClosure).toEqual({ numerator: 1, denominator: 3, percent: 33 });
    expect(o.overdueActions).toBe(1);
  });

  it("gives no-data rates for an empty workspace", () => {
    const o = getExecutiveOverview([], [], EMPTY_FEEDBACK, TODAY);
    for (const r of [o.readiness, o.mandatoryLearning, o.checkInCompletion, o.feedbackParticipation, o.actionClosure]) {
      expect(r.percent).toBeNull();
      expect(r.denominator).toBe(0);
    }
    expect(o.overdueActions).toBe(0);
  });

  it("has a written definition for every KPI", () => {
    for (const key of ["readiness", "mandatoryLearning", "checkInCompletion", "feedbackParticipation", "actionClosure", "overdueActions", "experienceTrends", "areaAverages"] as const) {
      expect(EXPERIENCE_KPI_DEFINITIONS[key].length).toBeGreaterThan(40);
    }
  });
});

describe("Readiness rate", () => {
  it("counts Ready and On track over active cases, using the existing rules", () => {
    const r = readinessRate(cases, TODAY);
    expect(r.mix).toEqual({ "Not ready": 3, "At risk": 2, "On track": 2, Ready: 1 });
    expect(r.numerator).toBe(r.mix.Ready + r.mix["On track"]);
  });

  it("excludes completed cases", () => {
    expect(readinessRate(someCases(2), TODAY).denominator).toBe(0);
  });
});

describe("Check-in completion", () => {
  it("excludes upcoming and cancelled check-ins and requires an outcome", () => {
    const fb = fbWith({
      meetings: [
        meeting("done", "c0", -3, "completed", "Agreed next steps"),
        meeting("held-no-outcome", "c0", -1, "scheduled"),
        meeting("today", "c0", 0, "scheduled"),
        meeting("future", "c0", 2, "scheduled"),
        meeting("cancelled", "c0", -2, "cancelled"),
      ],
    });
    expect(checkInCompletion(fb, TODAY)).toEqual({ numerator: 1, denominator: 3, percent: 33 });
  });

  it("is no data when nothing is due", () => {
    expect(checkInCompletion(fbWith({ meetings: [meeting("future", "c0", 5, "scheduled")] }), TODAY).percent).toBeNull();
  });
});

describe("Feedback participation", () => {
  it("excludes future surveys and keeps expired unsubmitted ones in the denominator", () => {
    // Started 100 days ago: Day 7, 30, 60 and 90 are all eligible; Day 7–60 have expired.
    const c = makeCase(-100, [], "p", "P");
    const fb = fbWith({ responses: [response("p", "day-90", 4)] });
    expect(feedbackParticipation([c], fb, TODAY)).toEqual({ numerator: 1, denominator: 4, percent: 25 });
    // Started 10 days ago: only Day 7 is eligible.
    expect(feedbackParticipation([makeCase(-10, [], "q", "Q")], EMPTY_FEEDBACK, TODAY)).toEqual({ numerator: 0, denominator: 1, percent: 0 });
    // Not started yet: nothing eligible.
    expect(feedbackParticipation([makeCase(5, [], "r", "R")], EMPTY_FEEDBACK, TODAY).percent).toBeNull();
  });

  it("is reported by checkpoint as counts, with future checkpoints as no data", () => {
    const rows = getParticipationByCheckpoint(cases, feedback, TODAY);
    expect(rows.map((r) => [r.checkpoint, r.rate.numerator, r.rate.denominator])).toEqual([
      ["day-7", 5, 6],
      ["day-30", 3, 4],
      ["day-60", 2, 2],
      ["day-90", 2, 2],
    ]);
    expect(getParticipationByCheckpoint([makeCase(-10, [], "q", "Q")], EMPTY_FEEDBACK, TODAY)[1].rate.percent).toBeNull();
  });
});

describe("Action closure and overdue actions", () => {
  const cs = someCases(1);
  const fb = fbWith({
    actions: [
      action("done", "c0", "Completed", -5),
      action("open", "c0", "Open", 3),
      action("progress-late", "c0", "In progress", -1),
      action("reopened", "c0", "Open", -2, 1),
      action("due-today", "c0", "Open", 0),
      action("completed-late", "c0", "Completed", -9),
      action("other-workspace", "zz", "Completed", -1),
    ],
  });

  it("is completed actions over all actions in the cohort; open, in-progress and reopened do not count", () => {
    expect(actionClosureRate(cs, fb)).toEqual({ numerator: 2, denominator: 6, percent: 33 });
  });

  it("counts open or in-progress actions due strictly before today as overdue", () => {
    expect(overdueActions(cs, fb, TODAY).map((a) => a.id).sort()).toEqual(["progress-late", "reopened"]);
  });

  it("is no data without actions", () => {
    expect(actionClosureRate(cs, EMPTY_FEEDBACK).percent).toBeNull();
  });
});

describe("Experience trends and the five-employee rule", () => {
  it("shows the seeded Day 7 group (5 distinct employees) and hides Day 30, 60 and 90", () => {
    expect(feedback.responses).toHaveLength(12);
    expect(new Set(feedback.responses.map((r) => r.caseId)).size).toBe(5);
    const t = getExperienceTrends(cases, feedback);
    expect(t.byCheckpoint[0].areas).toEqual({
      "role-clarity": { shown: true, average: 3.6, employees: 5 },
      "learning-development": { shown: true, average: 4, employees: 5 },
      "manager-support": { shown: true, average: 3.8, employees: 5 },
      "team-integration": { shown: true, average: 3.4, employees: 5 },
      "tools-resources": { shown: true, average: 3.6, employees: 5 },
    });
    // Day 30 has 3 respondents, Day 60 and Day 90 have 2 each.
    for (const g of t.byCheckpoint.slice(1)) for (const c of Object.values(g.areas)) expect(c).toEqual({ shown: false });
    expect(t.byArea.map((a) => a.cell)).toEqual([
      { shown: true, average: 3.8, employees: 5 },
      { shown: true, average: 3.9, employees: 5 },
      { shown: true, average: 3.5, employees: 5 },
      { shown: true, average: 3.6, employees: 5 },
      { shown: true, average: 3.4, employees: 5 },
    ]);
  });

  it("hides the Day 7 group again when one of its five employees is removed", () => {
    const withoutRafael = cases.filter((c) => c.id !== "demo-rafael-costa");
    const t = getExperienceTrends(withoutRafael, feedback);
    for (const g of t.byCheckpoint) for (const c of Object.values(g.areas)) expect(c).toEqual({ shown: false });
    for (const a of t.byArea) expect(a.cell).toEqual({ shown: false });
  });

  it("does not count several submissions by one employee as several people", () => {
    const cs = someCases(2);
    const fb = fbWith({
      responses: (["day-7", "day-30", "day-60", "day-90"] as const).flatMap((cp) => [response("c0", cp, 5), response("c1", cp, 1)]),
    });
    expect(getExperienceTrends(cs, fb).byArea.every((a) => !a.cell.shown)).toBe(true);
  });

  it("shows a group at exactly five distinct employees, and not at four", () => {
    const cs = someCases(5);
    const four = fbWith({ responses: cs.slice(0, 4).map((c) => response(c.id, "day-7", 4)) });
    expect(getExperienceTrends(cs, four).byCheckpoint[0].areas["role-clarity"]).toEqual({ shown: false });
    const five = fbWith({ responses: cs.map((c, i) => response(c.id, "day-7", i < 4 ? 4 : 2)) });
    expect(getExperienceTrends(cs, five).byCheckpoint[0].areas["role-clarity"]).toEqual({ shown: true, average: 3.6, employees: 5 });
  });

  it("averages per employee first so people with more surveys do not weigh more", () => {
    const cs = someCases(5);
    const fb = fbWith({
      responses: [
        response("c0", "day-7", 1),
        response("c0", "day-30", 1),
        response("c0", "day-60", 1),
        response("c0", "day-90", 5),
        ...cs.slice(1).map((c) => response(c.id, "day-7", 4)),
      ],
    });
    // c0 averages 2; the others 4 → (2 + 4 × 4) / 5 = 3.6. A pooled mean would be 2.75.
    const area = getExperienceTrends(cs, fb).byArea.find((a) => a.area === "role-clarity")!;
    expect(area.cell).toEqual({ shown: true, average: 3.6, employees: 5 });
  });

  it("adds the demo employee to the Day 7 group when he submits, and keeps other checkpoints hidden", () => {
    const { feedback: fb, result } = submitSurvey(feedback, DANIEL, "day-7", allFours, "", TODAY);
    expect(result).toBe("submitted");
    const t = getExperienceTrends(cases, fb);
    const day7 = t.byCheckpoint[0].areas;
    expect(day7["role-clarity"]).toEqual({ shown: true, average: 3.7, employees: 6 });
    expect(day7["tools-resources"]).toEqual({ shown: true, average: 3.7, employees: 6 });
    for (const g of t.byCheckpoint.slice(1)) for (const c of Object.values(g.areas)) expect(c).toEqual({ shown: false });
    expect(t.byArea.find((a) => a.area === "tools-resources")!.cell).toEqual({ shown: true, average: 3.5, employees: 6 });
  });

  it("returns suppressed cells with no value or count that a view could expose", () => {
    const t = getExperienceTrends(cases, feedback);
    const serialised = JSON.stringify(t.byCheckpoint.slice(1));
    expect(serialised).not.toMatch(/average|employees/);
  });

  it("never carries comments into the analytics", () => {
    const cs = someCases(5);
    const fb = fbWith({ responses: cs.map((c) => response(c.id, "day-7", 3, `Secret comment ${c.id}`)) });
    expect(JSON.stringify(getExperienceTrends(cs, fb))).not.toContain("Secret comment");
  });

  it("ignores responses from cases outside the reporting cohort", () => {
    const cs = someCases(4);
    const fb = fbWith({ responses: [...cs.map((c) => response(c.id, "day-7", 4)), response("outside", "day-7", 4)] });
    expect(getExperienceTrends(cs, fb).byCheckpoint[0].areas["role-clarity"].shown).toBe(false);
  });

  it("uses a threshold of five", () => {
    expect(MIN_GROUP_SIZE).toBe(5);
  });
});

describe("Learning & development", () => {
  it("reports progress by checkpoint with one status per assignment", () => {
    const rows = getLearningByCheckpoint(cases, learning, TODAY);
    for (const r of rows) expect(r.completed + r.inProgress + r.overdue + r.notStarted).toBe(r.assigned);
    expect(rows.reduce((s, r) => s + r.assigned, 0)).toBe(learning.length);
    expect(rows.reduce((s, r) => s + r.overdue, 0)).toBe(2);
  });

  it("reports mandatory completion and overdue counts by module, with no data for modules not due", () => {
    const modules = getLearningModuleReport(cases, learning, TODAY);
    const total = modules.reduce((s, m) => s + m.mandatoryCompletion.denominator, 0);
    expect(total).toBe(16);
    expect(modules.reduce((s, m) => s + m.mandatoryCompletion.numerator, 0)).toBe(14);
    for (const m of modules) if (m.mandatoryCompletion.denominator === 0) expect(m.mandatoryCompletion.percent).toBeNull();
    expect(modules.find((m) => m.module.id === "data-protection")!.overdueMandatory).toBe(1);
    expect(modules.find((m) => m.module.id === "health-safety")!.overdueMandatory).toBe(1);
  });
});

describe("Check-in report", () => {
  it("separates upcoming, completed and awaiting-outcome check-ins on the seed", () => {
    expect(getCheckInReport(cases, feedback, TODAY)).toEqual({
      completion: { numerator: 3, denominator: 3, percent: 100 },
      upcoming: 1,
      completed: 3,
      cancelled: 0,
      awaitingOutcome: 0,
      openActions: 2,
      overdueActions: 1,
      closure: { numerator: 1, denominator: 3, percent: 33 },
      reopenedActions: 1,
    });
  });
});

describe("Bottlenecks", () => {
  const b = getBottlenecks(cases, learning, feedback, TODAY);

  it("lists overdue tasks by owner, most overdue first", () => {
    expect(b.overdueTasksByOwner.map((o) => [o.owner, o.overdue])).toEqual([
      ["HR", 2],
      ["New employee", 2],
      ["IT", 1],
    ]);
  });

  it("lists overdue mandatory learning by module", () => {
    expect(b.overdueLearningByModule.map((m) => m.moduleId).sort()).toEqual(["data-protection", "health-safety"]);
  });

  it("flags a shared topic awaiting discussion without a scheduled check-in", () => {
    expect(b.checkInGaps).toEqual([{ caseId: "demo-ines-duarte", employeeName: "Inês Duarte", reason: "shared-topic-waiting" }]);
  });

  it("flags cases past Day 30 and within Day 90 without any check-in", () => {
    const c = makeCase(-40, [{ key: "a", dueIn: 5 }], "late", "Late Person");
    expect(getCheckInGaps([c], EMPTY_FEEDBACK, TODAY)).toEqual([{ caseId: "late", employeeName: "Late Person", reason: "no-check-in-after-day-30" }]);
    expect(getCheckInGaps([makeCase(-20, [{ key: "a", dueIn: 5 }], "early")], EMPTY_FEEDBACK, TODAY)).toEqual([]);
    expect(getCheckInGaps([makeCase(-120, [{ key: "a", dueIn: 5 }], "past")], EMPTY_FEEDBACK, TODAY)).toEqual([]);
    const booked = fbWith({ meetings: [meeting("m", "late", 3, "scheduled")] });
    expect(getCheckInGaps([c], booked, TODAY)).toEqual([]);
    const cancelled = fbWith({ meetings: [meeting("m", "late", 3, "cancelled")] });
    expect(getCheckInGaps([c], cancelled, TODAY)).toHaveLength(1);
  });

  it("lists reopened actions that are still open as recurring unresolved", () => {
    expect(b.unresolvedActions).toEqual([
      { id: "seed-action-lena-1", caseId: "demo-lena-fischer", description: "Set up a fixed fortnightly 1:1", reopenCount: 1, overdue: false },
    ]);
  });

  it("reports overdue tasks and due-task completion for every stage", () => {
    expect(b.stageDelays.map((s) => [s.stage, s.overdue])).toEqual([
      ["Pre-boarding", 1],
      ["Day 1", 1],
      ["First 30 days", 3],
      ["Day 60", 0],
      ["Day 90", 0],
    ]);
  });

  it("is empty for an empty workspace", () => {
    const e = getBottlenecks([], [], EMPTY_FEEDBACK, TODAY);
    expect(e.overdueTasksByOwner).toEqual([]);
    expect(e.overdueLearningByModule).toEqual([]);
    expect(e.checkInGaps).toEqual([]);
    expect(e.unresolvedActions).toEqual([]);
    expect(e.stageDelays.every((s) => s.overdue === 0 && s.dueCompletion === null)).toBe(true);
  });
});

