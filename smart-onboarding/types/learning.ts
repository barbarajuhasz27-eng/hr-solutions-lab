import type { ISODate } from "@/types/onboarding";

/* ------------------------------------------------------------------ */
/* Catalog content (static, defined in code, never persisted)          */
/* ------------------------------------------------------------------ */

export const LEARNING_MODULE_IDS = [
  "culture-values",
  "data-protection",
  "health-safety",
  "remote-working",
  "leading-new-team",
] as const;
export type LearningModuleId = (typeof LEARNING_MODULE_IDS)[number];

export type Lesson = {
  id: string;
  title: string;
  /** Short paragraphs of original, illustrative content. */
  body: string[];
  keyPoints: string[];
};

export type QuizOption = { id: string; text: string };

export type QuizQuestion = {
  id: string;
  prompt: string;
  options: QuizOption[];
  correctOptionId: string;
  /** Shown after the answer is checked, whether it was right or wrong. */
  explanation: string;
};

export type Quiz = {
  /** Minimum score, in percent, needed to pass. */
  passMark: number;
  questions: QuizQuestion[];
};

export type LearningModule = {
  id: LearningModuleId;
  title: string;
  summary: string;
  /** Estimated time to complete, in minutes. */
  durationMinutes: number;
  lessons: Lesson[];
  /** Modules without a quiz are complete once every lesson has been viewed. */
  quiz?: Quiz;
};

/* ------------------------------------------------------------------ */
/* Learning paths                                                      */
/* ------------------------------------------------------------------ */

export const LEARNING_CHECKPOINTS = ["day-7", "day-30", "day-60", "day-90"] as const;
export type LearningCheckpoint = (typeof LEARNING_CHECKPOINTS)[number];

/* ------------------------------------------------------------------ */
/* Persisted records                                                   */
/* ------------------------------------------------------------------ */

/** One completed quiz attempt. */
export type QuizResult = {
  attemptedAt: ISODate;
  /** Selected option per question id. */
  answers: Record<string, string>;
  correct: number;
  total: number;
  /** Whole percent, 0–100. */
  score: number;
  passed: boolean;
};

/** A module assigned to one employee, with their progress. */
export type LearningAssignment = {
  id: string;
  caseId: string;
  moduleId: LearningModuleId;
  mandatory: boolean;
  checkpoint: LearningCheckpoint;
  dueDate: ISODate;
  viewedLessonIds: string[];
  quizResults: QuizResult[];
  /** Set once every lesson is viewed and the quiz (if any) is passed. Never cleared by later attempts. */
  completedAt?: ISODate;
};
