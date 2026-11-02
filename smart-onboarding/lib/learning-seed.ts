import { addDays } from "@/lib/dates";
import { createAssignments, markLessonViewed, recordQuizAttempt, scoreQuiz } from "@/lib/learning";
import { getModule } from "@/lib/learning-catalog";
import type { LearningAssignment, LearningModuleId, Quiz } from "@/types/learning";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

type ProgressSpec = {
  /** Lessons viewed, in order ("all" = every lesson). */
  lessons: number | "all";
  /** Quiz attempts in order. */
  quiz?: ("pass" | "fail")[];
  /** Days before today when the learner was last active. */
  daysAgo: number;
};

/** Synthetic learning progress for the demo cases, chosen to cover every learning state. */
const SEED_PROGRESS: Record<string, Partial<Record<LearningModuleId, ProgressSpec>>> = {
  "demo-maya-lindqvist": {
    "culture-values": { lessons: 1, daysAgo: 1 },
  },
  "demo-daniel-okafor": {
    "culture-values": { lessons: "all", quiz: ["fail", "pass"], daysAgo: 3 },
    "health-safety": { lessons: 2, daysAgo: 2 },
    "data-protection": { lessons: 1, daysAgo: 0 },
  },
  "demo-sofia-marin": {
    "culture-values": { lessons: "all", quiz: ["pass"], daysAgo: 42 },
    "health-safety": { lessons: "all", quiz: ["pass"], daysAgo: 41 },
    "data-protection": { lessons: "all", quiz: ["pass"], daysAgo: 14 },
  },
  "demo-lena-fischer": {
    "culture-values": { lessons: "all", quiz: ["pass"], daysAgo: 90 },
    "health-safety": { lessons: "all", quiz: ["pass"], daysAgo: 89 },
    "data-protection": { lessons: "all", quiz: ["fail", "pass"], daysAgo: 70 },
    "remote-working": { lessons: "all", daysAgo: 30 },
  },
  "demo-rafael-costa": {
    "culture-values": { lessons: "all", quiz: ["pass"], daysAgo: 105 },
    "health-safety": { lessons: "all", quiz: ["pass"], daysAgo: 104 },
    "data-protection": { lessons: "all", quiz: ["pass"], daysAgo: 85 },
    "remote-working": { lessons: "all", daysAgo: 30 },
  },
  "demo-marcus-bell": {
    "culture-values": { lessons: "all", quiz: ["pass"], daysAgo: 20 },
    "health-safety": { lessons: "all", quiz: ["fail", "pass"], daysAgo: 17 },
    "data-protection": { lessons: 2, daysAgo: 3 },
    "remote-working": { lessons: "all", daysAgo: 15 },
    "leading-new-team": { lessons: 1, daysAgo: 5 },
  },
  "demo-ines-duarte": {
    "culture-values": { lessons: "all", quiz: ["pass"], daysAgo: 35 },
    "health-safety": { lessons: "all", quiz: ["pass"], daysAgo: 34 },
    "data-protection": { lessons: 1, daysAgo: 25 },
  },
};

/** Answers that pass (all correct) or fail (just enough wrong answers to fall below the pass mark). */
export function demoAnswers(quiz: Quiz, outcome: "pass" | "fail"): Record<string, string> {
  const answers: Record<string, string> = Object.fromEntries(quiz.questions.map((q) => [q.id, q.correctOptionId]));
  if (outcome === "pass") return answers;
  for (const q of quiz.questions) {
    answers[q.id] = q.options.find((o) => o.id !== q.correctOptionId)!.id;
    if (!scoreQuiz(quiz, answers).passed) break;
  }
  return answers;
}

function applyProgress(assignments: LearningAssignment[], id: string, spec: ProgressSpec, today: ISODate) {
  const target = assignments.find((a) => a.id === id);
  if (!target) return assignments;
  const learningModule = getModule(target.moduleId);
  const on = addDays(today, -spec.daysAgo);
  const lessons = spec.lessons === "all" ? learningModule.lessons : learningModule.lessons.slice(0, spec.lessons);
  let next = assignments;
  for (const lesson of lessons) next = markLessonViewed(next, id, lesson.id, on);
  for (const outcome of spec.quiz ?? []) {
    if (learningModule.quiz) next = recordQuizAttempt(next, id, demoAnswers(learningModule.quiz, outcome), on);
  }
  return next;
}

/**
 * Learning assignments for the given cases. Demo cases get their synthetic progress; any other
 * case gets its path with no progress.
 */
export function createSeedLearning(cases: readonly OnboardingCase[], today: ISODate): LearningAssignment[] {
  return cases.flatMap((c) => {
    let assignments = createAssignments(c);
    for (const [moduleId, spec] of Object.entries(SEED_PROGRESS[c.id] ?? {})) {
      const id = assignments.find((a) => a.moduleId === moduleId)?.id;
      if (id && spec) assignments = applyProgress(assignments, id, spec, today);
    }
    return assignments;
  });
}
