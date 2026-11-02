"use client";

import { useSyncExternalStore } from "react";
import { todayISO } from "@/lib/dates";
import { onboardingStore } from "@/lib/onboarding-store";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

type OnboardingState =
  | { hydrated: false; cases: null; today: null }
  | { hydrated: true; cases: OnboardingCase[]; today: ISODate };

const getSnapshot = (): OnboardingCase[] | null => onboardingStore.getSnapshot();
const getServerSnapshot = (): OnboardingCase[] | null => onboardingStore.getServerSnapshot();

/**
 * Reads onboarding data from the localStorage-backed store.
 * On the server and during hydration `hydrated` is false, so the first client render
 * matches the server HTML and components show a loading state instead of guessing.
 */
export function useOnboarding(): OnboardingState {
  const cases = useSyncExternalStore(onboardingStore.subscribe, getSnapshot, getServerSnapshot);
  if (cases === null) return { hydrated: false, cases: null, today: null };
  return { hydrated: true, cases, today: todayISO() };
}

export const onboardingActions = {
  addCase: onboardingStore.addCase,
  setTaskStatus: onboardingStore.setTaskStatus,
  setTaskStatusAs: onboardingStore.setTaskStatusAs,
  deleteCase: onboardingStore.deleteCase,
  resetDemo: onboardingStore.resetDemo,
};
