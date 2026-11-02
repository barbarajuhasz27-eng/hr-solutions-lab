import { addDays, diffInDays } from "@/lib/dates";
import { getModule, LEARNING_MODULES } from "@/lib/learning-catalog";
import type {
  LearningAssignment,
  LearningCheckpoint,
  LearningModule,
  LearningModuleId,
  Quiz,
  QuizResult,
} from "@/types/learning";
import type { ISODate, OnboardingCase, WorkflowContext } from "@/types/onboarding";

/* ------------------------------------------------------------------ */
/* Checkpoints                                                         */
/* ------------------------------------------------------------------ */

export const CHECKPOINTS: readonly { key: LearningCheckpoint; label: string; offsetDays: number }[] = [
  { key: "day-7", label: "Day 7", offsetDays: 7 },
  { key: "day-30", label: "Day 30", offsetDays: 30 },
  { key: "day-60", label: "Day 60", offsetDays: 60 },
  { key: "day-90", label: "Day 90", offsetDays: 90 },
];

export function checkpointLabel(key: LearningCheckpoint): string {
  return CHECKPOINTS.find((c) => c.key === key)!.label;
}

/** Due date of a checkpoint: start date + 7, 30, 60 or 90 days. */
export function checkpointDueDate(startDate: ISODate, key: LearningCheckpoint): ISODate {
  return addDays(startDate, CHECKPOINTS.find((c) => c.key === key)!.offsetDays);
}

/* ------------------------------------------------------------------ */
/* Learning paths                                                      */
/* ------------------------------------------------------------------ */

export type PathEntry = {
  moduleId: LearningModuleId;
  mandatory: boolean;
  checkpoint: LearningCheckpoint;
  /** Plain-language reason, shown to the employee and HR. */
  reason: string;
};

/**
 * The learning path for an onboarding context.
 *
 * | Module                        | Applies to            | Requirement | Due    |
 * |-------------------------------|-----------------------|-------------|--------|
 * | Company Culture & Values      | Everyone              | Mandatory   | Day 7  |
 * | Workplace Health & Safety     | Everyone              | Mandatory   | Day 7  |
 * | Data Protection Essentials    | Everyone              | Mandatory   | Day 30 |
 * | Remote Working Essentials     | Remote employees      | Mandatory   | Day 30 |
 * | Remote Working Essentials     | Office employees      | Optional    | Day 90 |
 * | Leading Your New Team         | People managers       | Mandatory   | Day 60 |
 */
export function buildLearningPath(context: WorkflowContext): PathEntry[] {
  const path: PathEntry[] = [
    { moduleId: "culture-values", mandatory: true, checkpoint: "day-7", reason: "Everyone joining the company" },
    { moduleId: "health-safety", mandatory: true, checkpoint: "day-7", reason: "Everyone joining the company" },
    { moduleId: "data-protection", mandatory: true, checkpoint: "day-30", reason: "Everyone joining the company" },
  ];
  path.push(
    context.workArrangement === "Remote"
      ? { moduleId: "remote-working", mandatory: true, checkpoint: "day-30", reason: "You work remotely" }
      : {
          moduleId: "remote-working",
          mandatory: false,
          checkpoint: "day-90",
          reason: "Useful for remote or hybrid days",
        },
  );
  if (context.peopleManager) {
    path.push({ moduleId: "leading-new-team", mandatory: true, checkpoint: "day-60", reason: "You lead a team" });
  }
  return path;
}

export function assignmentId(caseId: string, moduleId: LearningModuleId): string {
  return `${caseId}--learn--${moduleId}`;
}

/** Creates the case's learning assignments from its onboarding context, with no progress. */
export function createAssignments(onboarding: Pick<OnboardingCase, "id" | "startDate" | "workflow">): LearningAssignment[] {
  return buildLearningPath(onboarding.workflow).map((entry) => ({
    id: assignmentId(onboarding.id, entry.moduleId),
    caseId: onboarding.id,
    moduleId: entry.moduleId,
    mandatory: entry.mandatory,
    checkpoint: entry.checkpoint,
    dueDate: checkpointDueDate(onboarding.startDate, entry.checkpoint),
    viewedLessonIds: [],
    quizResults: [],
  }));
}

export function pathReason(onboarding: Pick<OnboardingCase, "workflow">, moduleId: LearningModuleId): string | null {
  return buildLearningPath(onboarding.workflow).find((e) => e.moduleId === moduleId)?.reason ?? null;
}

/**
 * Keeps assignments in line with the cases: adds any missing assignment from a case's path
 * and drops assignments whose case no longer exists. Existing progress is never changed.
 * Returns the input array itself when nothing changed.
 */
export function reconcileAssignments(
  cases: readonly OnboardingCase[],
  assignments: readonly LearningAssignment[],
): LearningAssignment[] {
  const caseIds = new Set(cases.map((c) => c.id));
  const kept = assignments.filter((a) => caseIds.has(a.caseId));
  const existing = new Set(kept.map((a) => a.id));
  const missing = cases.flatMap((c) => createAssignments(c).filter((a) => !existing.has(a.id)));
  if (missing.length === 0 && kept.length === assignments.length) return assignments as LearningAssignment[];
  return [...kept, ...missing];
}

/* ------------------------------------------------------------------ */
/* Quiz scoring                                                        */
/* ------------------------------------------------------------------ */

export function isCorrectAnswer(quiz: Quiz, questionId: string, optionId: string): boolean {
  return quiz.questions.find((q) => q.id === questionId)?.correctOptionId === optionId;
}

/** Score in whole percent. Passing requires score ≥ the module's pass mark. Unanswered = wrong. */
export function scoreQuiz(quiz: Quiz, answers: Record<string, string>): Omit<QuizResult, "attemptedAt" | "answers"> {
  const total = quiz.questions.length;
  const correct = quiz.questions.filter((q) => answers[q.id] === q.correctOptionId).length;
  const score = total === 0 ? 0 : Math.round((correct / total) * 100);
  return { correct, total, score, passed: score >= quiz.passMark };
}

/* ------------------------------------------------------------------ */
/* Completion and status                                               */
/* ------------------------------------------------------------------ */

export function hasPassedQuiz(assignment: Pick<LearningAssignment, "quizResults">): boolean {
  return assignment.quizResults.some((r) => r.passed);
}

export function allLessonsViewed(assignment: Pick<LearningAssignment, "viewedLessonIds">, learningModule: LearningModule): boolean {
  return learningModule.lessons.every((l) => assignment.viewedLessonIds.includes(l.id));
}

/** Complete when every lesson has been viewed and, if the module has a quiz, it has been passed. */
export function meetsCompletionRule(assignment: LearningAssignment, learningModule = getModule(assignment.moduleId)): boolean {
  return allLessonsViewed(assignment, learningModule) && (!learningModule.quiz || hasPassedQuiz(assignment));
}

export function isAssignmentComplete(assignment: Pick<LearningAssignment, "completedAt">): boolean {
  return assignment.completedAt !== undefined;
}

/** Open (not completed) and the due date is before today. Due today is not overdue. */
export function isAssignmentOverdue(assignment: LearningAssignment, today: ISODate): boolean {
  return !isAssignmentComplete(assignment) && diffInDays(today, assignment.dueDate) < 0;
}

export function isAssignmentDueSoon(assignment: LearningAssignment, today: ISODate, windowDays = 7): boolean {
  if (isAssignmentComplete(assignment)) return false;
  const days = diffInDays(today, assignment.dueDate);
  return days >= 0 && days <= windowDays;
}

export type LearningStatus = "Completed" | "Overdue" | "In progress" | "Not started";

export function assignmentStatus(assignment: LearningAssignment, today: ISODate): LearningStatus {
  if (isAssignmentComplete(assignment)) return "Completed";
  if (isAssignmentOverdue(assignment, today)) return "Overdue";
  if (assignment.viewedLessonIds.length > 0 || assignment.quizResults.length > 0) return "In progress";
  return "Not started";
}

export type AssignmentProgress = {
  lessonsViewed: number;
  lessonCount: number;
  hasQuiz: boolean;
  quizPassed: boolean;
  attempts: number;
  /** Steps = lessons + quiz (if any); percent of steps done. */
  percent: number;
};

export function assignmentProgress(assignment: LearningAssignment, learningModule = getModule(assignment.moduleId)): AssignmentProgress {
  const lessonsViewed = learningModule.lessons.filter((l) => assignment.viewedLessonIds.includes(l.id)).length;
  const hasQuiz = Boolean(learningModule.quiz);
  const quizPassed = hasPassedQuiz(assignment);
  const steps = learningModule.lessons.length + (hasQuiz ? 1 : 0);
  const done = lessonsViewed + (hasQuiz && quizPassed ? 1 : 0);
  return {
    lessonsViewed,
    lessonCount: learningModule.lessons.length,
    hasQuiz,
    quizPassed,
    attempts: assignment.quizResults.length,
    percent: steps === 0 ? 0 : Math.round((done / steps) * 100),
  };
}

/** The quiz opens once every lesson has been viewed. */
export function isQuizUnlocked(assignment: LearningAssignment, learningModule = getModule(assignment.moduleId)): boolean {
  return allLessonsViewed(assignment, learningModule);
}

/* ------------------------------------------------------------------ */
/* State transitions (pure)                                            */
/* ------------------------------------------------------------------ */

function withCompletion(assignment: LearningAssignment, today: ISODate): LearningAssignment {
  if (assignment.completedAt || !meetsCompletionRule(assignment)) return assignment;
  return { ...assignment, completedAt: today };
}

function updateOne(
  assignments: readonly LearningAssignment[],
  id: string,
  update: (a: LearningAssignment) => LearningAssignment,
): LearningAssignment[] {
  let changed = false;
  const next = assignments.map((a) => {
    if (a.id !== id) return a;
    const updated = update(a);
    if (updated !== a) changed = true;
    return updated;
  });
  return changed ? next : (assignments as LearningAssignment[]);
}

/** Records that a lesson was viewed. Viewing again changes nothing. Unknown lessons are ignored. */
export function markLessonViewed(
  assignments: readonly LearningAssignment[],
  id: string,
  lessonId: string,
  today: ISODate,
): LearningAssignment[] {
  return updateOne(assignments, id, (a) => {
    const learningModule = getModule(a.moduleId);
    if (!learningModule.lessons.some((l) => l.id === lessonId) || a.viewedLessonIds.includes(lessonId)) return a;
    return withCompletion({ ...a, viewedLessonIds: [...a.viewedLessonIds, lessonId] }, today);
  });
}

/**
 * Records a quiz attempt. Attempts are allowed only once every lesson is viewed; retries are
 * unlimited. A later failed attempt never removes a completion.
 */
export function recordQuizAttempt(
  assignments: readonly LearningAssignment[],
  id: string,
  answers: Record<string, string>,
  today: ISODate,
): LearningAssignment[] {
  return updateOne(assignments, id, (a) => {
    const learningModule = getModule(a.moduleId);
    if (!learningModule.quiz || !isQuizUnlocked(a, learningModule)) return a;
    const result: QuizResult = { attemptedAt: today, answers: { ...answers }, ...scoreQuiz(learningModule.quiz, answers) };
    return withCompletion({ ...a, quizResults: [...a.quizResults, result] }, today);
  });
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

export function assignmentsForCase(assignments: readonly LearningAssignment[], caseId: string): LearningAssignment[] {
  const order = new Map(LEARNING_MODULES.map((m, i) => [m.id, i]));
  return assignments
    .filter((a) => a.caseId === caseId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (order.get(a.moduleId)! - order.get(b.moduleId)!));
}

export type CheckpointGroup = {
  checkpoint: LearningCheckpoint;
  label: string;
  dueDate: ISODate | null;
  assignments: LearningAssignment[];
};

/** Groups a case's assignments by Day 7 / 30 / 60 / 90 checkpoint (empty checkpoints included). */
export function groupByCheckpoint(assignments: readonly LearningAssignment[]): CheckpointGroup[] {
  return CHECKPOINTS.map((c) => {
    const items = assignments.filter((a) => a.checkpoint === c.key);
    return { checkpoint: c.key, label: c.label, dueDate: items[0]?.dueDate ?? null, assignments: items };
  });
}

/** The open assignments to work on next: overdue first, then by due date. */
export function nextAssignments(assignments: readonly LearningAssignment[], today: ISODate, limit = 3): LearningAssignment[] {
  return assignments
    .filter((a) => !isAssignmentComplete(a))
    .sort((a, b) => {
      const ao = isAssignmentOverdue(a, today) ? 0 : 1;
      const bo = isAssignmentOverdue(b, today) ? 0 : 1;
      return ao - bo || a.dueDate.localeCompare(b.dueDate) || Number(b.mandatory) - Number(a.mandatory);
    })
    .slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* HR reporting                                                        */
/* ------------------------------------------------------------------ */

export const LEARNING_KPI_DEFINITIONS = {
  mandatoryCompletion:
    "Completed mandatory assignments due on or before today ÷ all mandatory assignments due on or before today. Assignments due later are excluded.",
  overdue: "Assignments (mandatory or optional) that are not completed and whose due date is before today. Due today is not overdue.",
  inProgress:
    "Open assignments with at least one lesson viewed or one quiz attempt that are not overdue. Overdue assignments are counted only under Overdue, so the tiles do not overlap.",
  completed: "Assignments completed: every lesson viewed and, where the module has a quiz, the quiz passed.",
} as const;

export type Rate = { numerator: number; denominator: number; percent: number | null };

function rate(numerator: number, denominator: number): Rate {
  return { numerator, denominator, percent: denominator === 0 ? null : Math.round((numerator / denominator) * 100) };
}

/** Mandatory learning completion, per the definition above. */
export function mandatoryLearningCompletion(assignments: readonly LearningAssignment[], today: ISODate): Rate {
  const due = assignments.filter((a) => a.mandatory && diffInDays(today, a.dueDate) <= 0);
  return rate(due.filter(isAssignmentComplete).length, due.length);
}

export type LearningSummary = {
  mandatoryCompletion: Rate;
  overdue: number;
  overdueMandatory: number;
  inProgress: number;
  completed: number;
  total: number;
};

export function getLearningSummary(assignments: readonly LearningAssignment[], today: ISODate): LearningSummary {
  const statuses = assignments.map((a) => assignmentStatus(a, today));
  return {
    mandatoryCompletion: mandatoryLearningCompletion(assignments, today),
    overdue: statuses.filter((s) => s === "Overdue").length,
    overdueMandatory: assignments.filter((a) => a.mandatory && isAssignmentOverdue(a, today)).length,
    inProgress: statuses.filter((s) => s === "In progress").length,
    completed: statuses.filter((s) => s === "Completed").length,
    total: assignments.length,
  };
}

export type ModuleSummary = {
  module: LearningModule;
  assigned: number;
  mandatoryFor: number;
  completed: number;
  overdue: number;
  inProgress: number;
};

export function getModuleSummaries(assignments: readonly LearningAssignment[], today: ISODate): ModuleSummary[] {
  return LEARNING_MODULES.map((learningModule) => {
    const items = assignments.filter((a) => a.moduleId === learningModule.id);
    const statuses = items.map((a) => assignmentStatus(a, today));
    return {
      module: learningModule,
      assigned: items.length,
      mandatoryFor: items.filter((a) => a.mandatory).length,
      completed: statuses.filter((s) => s === "Completed").length,
      overdue: statuses.filter((s) => s === "Overdue").length,
      inProgress: statuses.filter((s) => s === "In progress").length,
    };
  });
}

export type EmployeeLearningRow = {
  onboarding: OnboardingCase;
  assignments: LearningAssignment[];
  mandatoryDone: number;
  mandatoryTotal: number;
  overdue: number;
  next: LearningAssignment | null;
};

export function getEmployeeLearningRows(
  cases: readonly OnboardingCase[],
  assignments: readonly LearningAssignment[],
  today: ISODate,
): EmployeeLearningRow[] {
  return cases.map((onboarding) => {
    const own = assignmentsForCase(assignments, onboarding.id);
    const mandatory = own.filter((a) => a.mandatory);
    return {
      onboarding,
      assignments: own,
      mandatoryDone: mandatory.filter(isAssignmentComplete).length,
      mandatoryTotal: mandatory.length,
      overdue: own.filter((a) => isAssignmentOverdue(a, today)).length,
      next: nextAssignments(own, today, 1)[0] ?? null,
    };
  });
}
