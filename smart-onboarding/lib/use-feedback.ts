"use client";

import { useSyncExternalStore } from "react";
import { todayISO } from "@/lib/dates";
import { onboardingStore } from "@/lib/onboarding-store";
import type { FeedbackState } from "@/types/feedback";
import type { ISODate } from "@/types/onboarding";

type FeedbackHookState =
  | { hydrated: false; state: null; today: null }
  | { hydrated: true; state: FeedbackState; today: ISODate };

const getSnapshot = (): FeedbackState | null => onboardingStore.getFeedbackSnapshot();
const getServerSnapshot = (): FeedbackState | null => onboardingStore.getFeedbackServerSnapshot();

/** Surveys, topics, check-ins and actions from the same localStorage-backed workspace. */
export function useFeedback(): FeedbackHookState {
  const state = useSyncExternalStore(onboardingStore.subscribe, getSnapshot, getServerSnapshot);
  if (state === null) return { hydrated: false, state: null, today: null };
  return { hydrated: true, state, today: todayISO() };
}

export const feedbackActions = {
  submitSurvey: onboardingStore.submitSurvey,
  reviewTopic: onboardingStore.reviewTopic,
  bookMeeting: onboardingStore.bookMeeting,
  cancelMeeting: onboardingStore.cancelMeeting,
  addAgendaPoint: onboardingStore.addAgendaPoint,
  completeMeeting: onboardingStore.completeMeeting,
  createAction: onboardingStore.createAction,
  setActionStatus: onboardingStore.setActionStatus,
  recordFollowUp: onboardingStore.recordFollowUp,
  reopenAction: onboardingStore.reopenAction,
};
