import type { ISODate } from "@/types/onboarding";

/* ------------------------------------------------------------------ */
/* Pulse surveys (CONFIDENTIAL)                                        */
/* ------------------------------------------------------------------ */

export const SURVEY_CHECKPOINTS = ["day-7", "day-30", "day-60", "day-90"] as const;
export type SurveyCheckpoint = (typeof SURVEY_CHECKPOINTS)[number];

export const FEEDBACK_AREAS = [
  "role-clarity",
  "learning-development",
  "manager-support",
  "team-integration",
  "tools-resources",
] as const;
export type FeedbackArea = (typeof FEEDBACK_AREAS)[number];

export type Rating = 1 | 2 | 3 | 4 | 5;

/**
 * A submitted pulse survey. CONFIDENTIAL: ratings and the comment are visible to the employee
 * and, behind an explicit "show" step, to HR. They are never copied into agendas, actions or
 * shared views.
 */
export type SurveyResponse = {
  id: string;
  caseId: string;
  checkpoint: SurveyCheckpoint;
  submittedAt: ISODate;
  ratings: Record<FeedbackArea, Rating>;
  comment?: string;
};

/* ------------------------------------------------------------------ */
/* Discussion topics                                                   */
/* ------------------------------------------------------------------ */

/**
 * suggested: created by the rule (a rating of 2 or below), visible to the employee only.
 * shared:    the employee agreed to discuss it; visible to HR and added to new agendas.
 * private:   the employee chose not to share it. It stays visible to them only.
 * discussed: it was on the agenda of a meeting that has been completed.
 */
export const TOPIC_STATUSES = ["suggested", "shared", "private", "discussed"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];

/** A suggested discussion topic. It holds the area only, never the rating or the comment. */
export type DiscussionTopic = {
  id: string;
  caseId: string;
  responseId: string;
  checkpoint: SurveyCheckpoint;
  area: FeedbackArea;
  status: TopicStatus;
  createdAt: ISODate;
  reviewedAt?: ISODate;
  /** Optional words the employee chose to share with the topic. SHARED once the topic is shared. */
  employeeNote?: string;
};

/* ------------------------------------------------------------------ */
/* Check-in meetings (SHARED, except hrNote)                           */
/* ------------------------------------------------------------------ */

export const MEETING_TYPES = ["hr", "manager", "buddy"] as const;
export type MeetingType = (typeof MEETING_TYPES)[number];

export const MEETING_STATUSES = ["scheduled", "completed", "cancelled"] as const;
export type MeetingStatus = (typeof MEETING_STATUSES)[number];

export const AGENDA_SOURCES = ["meeting-type", "milestone", "topic", "employee", "participant"] as const;
export type AgendaSource = (typeof AGENDA_SOURCES)[number];

export type AgendaItem = {
  id: string;
  source: AgendaSource;
  text: string;
  /** "System" for generated items, otherwise the person who added it. */
  addedBy: string;
  topicId?: string;
};

export type Meeting = {
  id: string;
  caseId: string;
  type: MeetingType;
  slotId: string;
  hostName: string;
  date: ISODate;
  /** "HH:MM", local time. Fictional slots only; no calendar integration. */
  time: string;
  durationMinutes: number;
  status: MeetingStatus;
  bookedAt: ISODate;
  agenda: AgendaItem[];
  /** Agreed outcome, written when the meeting is completed. SHARED with the employee. */
  outcome?: string;
  completedAt?: ISODate;
  cancelledAt?: ISODate;
  /** CONFIDENTIAL: HR-only note. Never shown in the portal or in shared agendas. */
  hrNote?: string;
};

/* ------------------------------------------------------------------ */
/* Action plans (SHARED)                                               */
/* ------------------------------------------------------------------ */

export const ACTION_OWNERS = ["Employee", "HR", "Hiring manager", "Buddy"] as const;
export type ActionOwner = (typeof ACTION_OWNERS)[number];

export const ACTION_STATUSES = ["Open", "In progress", "Completed"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export type ActionSource = { kind: "meeting"; meetingId: string } | { kind: "topic"; topicId: string };

export const FOLLOW_UP_RESPONSES = ["helped", "partly", "not-helped"] as const;
export type FollowUpResponse = (typeof FOLLOW_UP_RESPONSES)[number];

export type FollowUp = { at: ISODate; response: FollowUpResponse };

export const ACTION_EVENT_TYPES = ["created", "status", "follow-up", "reopened"] as const;
export type ActionEventType = (typeof ACTION_EVENT_TYPES)[number];

export type ActionEvent = { at: ISODate; type: ActionEventType; detail: string; by: string };

export type ActionItem = {
  id: string;
  caseId: string;
  description: string;
  owner: ActionOwner;
  dueDate: ISODate;
  status: ActionStatus;
  source: ActionSource;
  /** Optional link to an existing onboarding task of the same case (no task is duplicated). */
  linkedTaskId?: string;
  createdAt: ISODate;
  completedAt?: ISODate;
  /** How often the action was reopened after a "did not help" follow-up. */
  reopenCount: number;
  followUps: FollowUp[];
  /** Append-only history; nothing is removed when an action is reopened. */
  history: ActionEvent[];
};

export type FeedbackState = {
  responses: SurveyResponse[];
  topics: DiscussionTopic[];
  meetings: Meeting[];
  actions: ActionItem[];
};
