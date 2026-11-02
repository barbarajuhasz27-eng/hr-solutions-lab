import { describe, expect, it } from "vitest";
import {
  assignmentProgress,
  assignmentStatus,
  createAssignments,
  getLearningSummary,
  getModuleSummaries,
  isAssignmentDueSoon,
  isAssignmentOverdue,
  isQuizUnlocked,
  mandatoryLearningCompletion,
  markLessonViewed,
  recordQuizAttempt,
  scoreQuiz,
} from "@/lib/learning";
import { getModule } from "@/lib/learning-catalog";
import { createSeedLearning, demoAnswers } from "@/lib/learning-seed";
import { createSeedCases } from "@/lib/seed-data";
import type { LearningAssignment, LearningModuleId } from "@/types/learning";
import { makeCase, TODAY } from "./helpers";

const culture = getModule("culture-values");
const dataProtection = getModule("data-protection");
const quiz = culture.quiz!; // 4 questions, pass mark 75%

function fresh(moduleId: LearningModuleId, dueIn = 10): LearningAssignment {
  const c = { ...makeCase(dueIn - 7, [], "c"), workflow: { workArrangement: "Remote" as const, peopleManager: true, internationalHire: false } };
  return createAssignments(c).find((a) => a.moduleId === moduleId)!;
}

function readAll(list: LearningAssignment[], id: string, moduleId: LearningModuleId, on = TODAY) {
  return getModule(moduleId).lessons.reduce((acc, l) => markLessonViewed(acc, id, l.id, on), list);
}

const answersWith = (wrong: number) => {
  const a = demoAnswers(quiz, "pass");
  quiz.questions.slice(0, wrong).forEach((q) => (a[q.id] = q.options.find((o) => o.id !== q.correctOptionId)!.id));
  return a;
};

describe("quiz scoring", () => {
  it("scores in whole percent and passes at exactly the pass mark", () => {
    expect(scoreQuiz(quiz, answersWith(0))).toEqual({ correct: 4, total: 4, score: 100, passed: true });
    expect(scoreQuiz(quiz, answersWith(1))).toEqual({ correct: 3, total: 4, score: 75, passed: true });
    expect(scoreQuiz(quiz, answersWith(2))).toEqual({ correct: 2, total: 4, score: 50, passed: false });
  });

  it("treats unanswered questions as wrong", () => {
    expect(scoreQuiz(quiz, {})).toMatchObject({ correct: 0, score: 0, passed: false });
  });

  it("uses each module's own pass mark", () => {
    const dp = dataProtection.quiz!; // 5 questions, 80%
    const oneWrong = demoAnswers(dp, "pass");
    oneWrong[dp.questions[0].id] = dp.questions[0].options.find((o) => o.id !== dp.questions[0].correctOptionId)!.id;
    expect(scoreQuiz(dp, oneWrong)).toMatchObject({ score: 80, passed: true });
    expect(scoreQuiz(dp, demoAnswers(dp, "fail")).passed).toBe(false);
  });
});

describe("quiz attempts and retry", () => {
  it("only accepts attempts once every lesson has been viewed", () => {
    const a = fresh("culture-values");
    let list = [a];
    expect(isQuizUnlocked(a)).toBe(false);
    expect(recordQuizAttempt(list, a.id, answersWith(0), TODAY)).toBe(list);
    list = markLessonViewed(list, a.id, "values", TODAY);
    expect(recordQuizAttempt(list, a.id, answersWith(0), TODAY)).toBe(list);
    list = readAll(list, a.id, "culture-values");
    expect(isQuizUnlocked(list[0])).toBe(true);
  });

  it("allows retrying after a failed attempt and completes on a pass", () => {
    const a = fresh("culture-values");
    let list = readAll([a], a.id, "culture-values", "2026-10-30");
    list = recordQuizAttempt(list, a.id, answersWith(2), "2026-10-31");
    expect(list[0].quizResults.map((r) => r.passed)).toEqual([false]);
    expect(list[0].completedAt).toBeUndefined();
    expect(assignmentStatus(list[0], TODAY)).toBe("In progress");

    list = recordQuizAttempt(list, a.id, answersWith(1), TODAY);
    expect(list[0].quizResults.map((r) => [r.score, r.passed, r.attemptedAt])).toEqual([
      [50, false, "2026-10-31"],
      [75, true, TODAY],
    ]);
    expect(list[0].completedAt).toBe(TODAY);
    expect(assignmentStatus(list[0], TODAY)).toBe("Completed");
  });

  it("never removes a completion when a later practice attempt fails", () => {
    const a = fresh("culture-values");
    let list = readAll([a], a.id, "culture-values", "2026-10-30");
    list = recordQuizAttempt(list, a.id, answersWith(0), "2026-10-30");
    list = recordQuizAttempt(list, a.id, answersWith(4), TODAY);
    expect(list[0].quizResults).toHaveLength(2);
    expect(list[0].completedAt).toBe("2026-10-30");
  });

  it("ignores quiz attempts for modules without a quiz", () => {
    const a = fresh("remote-working");
    const list = readAll([a], a.id, "remote-working");
    expect(recordQuizAttempt(list, a.id, {}, TODAY)).toBe(list);
  });
});

describe("completion rules", () => {
  it("requires every lesson and a passed quiz", () => {
    const a = fresh("culture-values");
    let list = markLessonViewed([a], a.id, "values", TODAY);
    list = markLessonViewed(list, a.id, "ways-of-working", TODAY);
    expect(list[0].completedAt).toBeUndefined();
    expect(assignmentProgress(list[0])).toMatchObject({ lessonsViewed: 2, lessonCount: 3, percent: 50 });
    list = markLessonViewed(list, a.id, "finding-help", TODAY);
    expect(list[0].completedAt).toBeUndefined(); // quiz not passed yet
    expect(assignmentProgress(list[0]).percent).toBe(75);
  });

  it("completes a module without a quiz once every lesson is viewed", () => {
    const a = fresh("remote-working");
    const list = readAll([a], a.id, "remote-working", "2026-11-01");
    expect(list[0].completedAt).toBe("2026-11-01");
    expect(assignmentProgress(list[0])).toMatchObject({ hasQuiz: false, percent: 100 });
  });

  it("counts a lesson once and ignores unknown lessons", () => {
    const a = fresh("culture-values");
    const once = markLessonViewed([a], a.id, "values", TODAY);
    expect(markLessonViewed(once, a.id, "values", TODAY)).toBe(once);
    expect(markLessonViewed(once, a.id, "not-a-lesson", TODAY)).toBe(once);
    expect(once[0].viewedLessonIds).toEqual(["values"]);
  });

  it("leaves other assignments untouched", () => {
    const a = fresh("culture-values");
    const b = fresh("health-safety");
    const list = markLessonViewed([a, b], a.id, "values", TODAY);
    expect(list[1]).toBe(b);
  });
});

describe("overdue and status", () => {
  it("is overdue only when open and the due date is before today", () => {
    expect(isAssignmentOverdue(fresh("culture-values", -1), TODAY)).toBe(true);
    expect(isAssignmentOverdue(fresh("culture-values", 0), TODAY)).toBe(false);
    expect(isAssignmentOverdue({ ...fresh("culture-values", -5), completedAt: "2026-10-31" }, TODAY)).toBe(false);
  });

  it("derives the status in a fixed order", () => {
    const open = fresh("culture-values", 5);
    expect(assignmentStatus(open, TODAY)).toBe("Not started");
    expect(assignmentStatus({ ...open, viewedLessonIds: ["values"] }, TODAY)).toBe("In progress");
    expect(assignmentStatus({ ...fresh("culture-values", -2), viewedLessonIds: ["values"] }, TODAY)).toBe("Overdue");
    expect(assignmentStatus({ ...fresh("culture-values", -2), completedAt: TODAY }, TODAY)).toBe("Completed");
  });

  it("flags open assignments due within 7 days as due soon", () => {
    expect(isAssignmentDueSoon(fresh("culture-values", 0), TODAY)).toBe(true);
    expect(isAssignmentDueSoon(fresh("culture-values", 7), TODAY)).toBe(true);
    expect(isAssignmentDueSoon(fresh("culture-values", 8), TODAY)).toBe(false);
    expect(isAssignmentDueSoon(fresh("culture-values", -1), TODAY)).toBe(false);
  });
});

describe("HR reporting", () => {
  it("calculates mandatory completion over assignments due on or before today", () => {
    const due = fresh("culture-values", -3);
    const dueToday = fresh("health-safety", 0);
    const later = { ...fresh("data-protection", 20), completedAt: TODAY }; // completed but not yet due: excluded
    const optional = { ...fresh("remote-working", -3), mandatory: false };
    expect(mandatoryLearningCompletion([{ ...due, completedAt: TODAY }, dueToday, later, optional], TODAY)).toEqual({
      numerator: 1,
      denominator: 2,
      percent: 50,
    });
    expect(mandatoryLearningCompletion([later], TODAY)).toEqual({ numerator: 0, denominator: 0, percent: null });
  });

  it("matches the seeded demo data", () => {
    const learning = createSeedLearning(createSeedCases(TODAY), TODAY);
    expect(getLearningSummary(learning, TODAY)).toEqual({
      mandatoryCompletion: { numerator: 14, denominator: 16, percent: 88 },
      overdue: 2,
      overdueMandatory: 2,
      inProgress: 4,
      completed: 17,
      total: 42,
    });
    const overdue = learning.filter((a) => isAssignmentOverdue(a, TODAY)).map((a) => `${a.caseId}:${a.moduleId}`);
    expect(overdue.sort()).toEqual(["demo-daniel-okafor:health-safety", "demo-ines-duarte:data-protection"]);
    expect(getModuleSummaries(learning, TODAY).find((m) => m.module.id === "leading-new-team")).toMatchObject({
      assigned: 2,
      mandatoryFor: 2,
      completed: 0,
      inProgress: 1,
    });
  });

  it("builds seeded progress through the same rules", () => {
    const learning = createSeedLearning(createSeedCases(TODAY), TODAY);
    const daniel = learning.find((a) => a.id === "demo-daniel-okafor--learn--culture-values")!;
    expect(daniel.quizResults.map((r) => r.passed)).toEqual([false, true]);
    expect(daniel.completedAt).toBe("2026-10-30");
    for (const a of learning) {
      if (a.completedAt) expect(assignmentProgress(a).percent).toBe(100);
    }
  });
});
