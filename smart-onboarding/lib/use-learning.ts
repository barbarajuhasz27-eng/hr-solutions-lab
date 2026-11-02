"use client";

import { useSyncExternalStore } from "react";
import { todayISO } from "@/lib/dates";
import { onboardingStore } from "@/lib/onboarding-store";
import type { LearningAssignment } from "@/types/learning";
import type { ISODate } from "@/types/onboarding";

type LearningState =
  | { hydrated: false; assignments: null; today: null }
  | { hydrated: true; assignments: LearningAssignment[]; today: ISODate };

const getSnapshot = (): LearningAssignment[] | null => onboardingStore.getLearningSnapshot();
const getServerSnapshot = (): LearningAssignment[] | null => onboardingStore.getLearningServerSnapshot();

/** Learning assignments from the same localStorage-backed workspace as the onboarding cases. */
export function useLearning(): LearningState {
  const assignments = useSyncExternalStore(onboardingStore.subscribe, getSnapshot, getServerSnapshot);
  if (assignments === null) return { hydrated: false, assignments: null, today: null };
  return { hydrated: true, assignments, today: todayISO() };
}

export const learningActions = {
  viewLesson: onboardingStore.viewLesson,
  submitQuiz: onboardingStore.submitQuiz,
};
