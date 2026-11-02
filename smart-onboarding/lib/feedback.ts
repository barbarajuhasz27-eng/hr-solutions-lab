import { addDays, diffInDays, formatShortDate, isValidISODate, parseISODate } from "@/lib/dates";
import { checkpointDueDate } from "@/lib/learning";
import { getMilestones, pickNextMilestone } from "@/lib/metrics";
import type {
  ActionItem,
  ActionOwner,
  ActionSource,
  ActionStatus,
  AgendaItem,
  DiscussionTopic,
  FeedbackArea,
  FeedbackState,
  FollowUpResponse,
  Meeting,
  MeetingType,
  Rating,
  SurveyCheckpoint,
  SurveyResponse,
} from "@/types/feedback";
import { FEEDBACK_AREAS, SURVEY_CHECKPOINTS } from "@/types/feedback";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

/*
 * Feedback, check-ins and action plans. Every function here is pure and deterministic:
 * transitions return a new FeedbackState (or the same object when nothing changes), so the
 * rules can be tested without a browser.
 *
 * Privacy model
 *   CONFIDENTIAL  survey ratings and comments (SurveyResponse), the HR-only meeting note
 *                 (Meeting.hrNote), and suggested topics the employee has not shared.
 *   SHARED        topics the employee chose to share, meeting agendas and agreed outcomes,
 *                 action plans and their follow-ups.
 * Nothing in this file copies a rating or a comment into a shared record.
 */

export const EMPTY_FEEDBACK: FeedbackState = { responses: [], topics: [], meetings: [], actions: [] };

/* ------------------------------------------------------------------ */
/* Surveys                                                             */
/* ------------------------------------------------------------------ */

export const AREA_INFO: Record<FeedbackArea, { label: string; question: string; topic: string }> = {
  "role-clarity": {
    label: "Role clarity",
    question: "I understand what is expected of me in my role.",
    topic: "Clarifying expectations for the role",
  },
  "learning-development": {
    label: "Learning and development",
    question: "I am getting the learning I need to do my job well.",
    topic: "Learning and development support",
  },
  "manager-support": {
    label: "Manager support",
    question: "I get the support I need from my manager.",
    topic: "Support from the manager",
  },
  "team-integration": {
    label: "Team integration",
    question: "I feel welcome and included in my team.",
    topic: "Settling into the team",
  },
  "tools-resources": {
    label: "Tools and resources",
    question: "I have the tools, access and resources I need.",
    topic: "Tools, access and resources",
  },
};

export const RATING_LABELS: Record<Rating, string> = {
  1: "Strongly disagree",
  2: "Disagree",
  3: "Neutral",
  4: "Agree",
  5: "Strongly agree",
};

/** A rating at or below this value suggests a discussion topic. Nothing else happens. */
export const LOW_RATING_THRESHOLD = 2;

/** Days a survey stays open from its checkpoint date (the checkpoint day included). */
export const SURVEY_WINDOW_DAYS = 14;

export const COMMENT_MAX_LENGTH = 1000;

export function surveyLabel(checkpoint: SurveyCheckpoint): string {
  return `Day ${checkpoint.slice(4)}`;
}

export function surveyId(caseId: string, checkpoint: SurveyCheckpoint): string {
  return `${caseId}--survey--${checkpoint}`;
}

export function surveyOpensOn(startDate: ISODate, checkpoint: SurveyCheckpoint): ISODate {
  return checkpointDueDate(startDate, checkpoint);
}

/** Last day the survey can be submitted. */
export function surveyClosesOn(startDate: ISODate, checkpoint: SurveyCheckpoint): ISODate {
  return addDays(surveyOpensOn(startDate, checkpoint), SURVEY_WINDOW_DAYS - 1);
}

export type SurveyState = "upcoming" | "open" | "submitted" | "closed";

export type SurveyInfo = {
  id: string;
  checkpoint: SurveyCheckpoint;
  label: string;
  opensOn: ISODate;
  closesOn: ISODate;
  state: SurveyState;
  response?: SurveyResponse;
};

export function surveyState(
  onboarding: Pick<OnboardingCase, "startDate">,
  checkpoint: SurveyCheckpoint,
  submitted: boolean,
  today: ISODate,
): SurveyState {
  if (submitted) return "submitted";
  if (diffInDays(today, surveyOpensOn(onboarding.startDate, checkpoint)) > 0) return "upcoming";
  if (diffInDays(surveyClosesOn(onboarding.startDate, checkpoint), today) > 0) return "closed";
  return "open";
}

export function getSurveys(
  onboarding: Pick<OnboardingCase, "id" | "startDate">,
  responses: readonly SurveyResponse[],
  today: ISODate,
): SurveyInfo[] {
  return SURVEY_CHECKPOINTS.map((checkpoint) => {
    const response = responses.find((r) => r.caseId === onboarding.id && r.checkpoint === checkpoint);
    return {
      id: surveyId(onboarding.id, checkpoint),
      checkpoint,
      label: surveyLabel(checkpoint),
      opensOn: surveyOpensOn(onboarding.startDate, checkpoint),
      closesOn: surveyClosesOn(onboarding.startDate, checkpoint),
      state: surveyState(onboarding, checkpoint, Boolean(response), today),
      response,
    };
  });
}

export function isRating(value: unknown): value is Rating {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}

/**
 * The transparent insight rule: each area rated 2 or below suggests a discussion topic for the
 * employee to review. It is not a performance warning or a risk classification, and it never
 * creates an action.
 */
export function suggestTopics(response: SurveyResponse): DiscussionTopic[] {
  return FEEDBACK_AREAS.filter((area) => response.ratings[area] <= LOW_RATING_THRESHOLD).map((area) => ({
    id: `${response.id}--topic--${area}`,
    caseId: response.caseId,
    responseId: response.id,
    checkpoint: response.checkpoint,
    area,
    status: "suggested",
    createdAt: response.submittedAt,
  }));
}

export type SubmitResult = "submitted" | "already-submitted" | "not-open" | "invalid";

/**
 * Submits a survey once. A second submission for the same checkpoint is refused, as is a
 * survey outside its window or with a missing rating. Suggested topics are created; actions are not.
 */
export function submitSurvey(
  feedback: FeedbackState,
  onboarding: Pick<OnboardingCase, "id" | "startDate">,
  checkpoint: SurveyCheckpoint,
  ratings: Partial<Record<FeedbackArea, number>>,
  comment: string,
  today: ISODate,
): { feedback: FeedbackState; result: SubmitResult } {
  if (feedback.responses.some((r) => r.caseId === onboarding.id && r.checkpoint === checkpoint)) {
    return { feedback, result: "already-submitted" };
  }
  if (surveyState(onboarding, checkpoint, false, today) !== "open") return { feedback, result: "not-open" };
  if (!FEEDBACK_AREAS.every((area) => isRating(ratings[area]))) return { feedback, result: "invalid" };

  const trimmed = comment.trim().slice(0, COMMENT_MAX_LENGTH);
  const response: SurveyResponse = {
    id: surveyId(onboarding.id, checkpoint),
    caseId: onboarding.id,
    checkpoint,
    submittedAt: today,
    ratings: ratings as Record<FeedbackArea, Rating>,
    ...(trimmed ? { comment: trimmed } : {}),
  };
  return {
    feedback: {
      ...feedback,
      responses: [...feedback.responses, response],
      topics: [...feedback.topics, ...suggestTopics(response)],
    },
    result: "submitted",
  };
}

/* ------------------------------------------------------------------ */
/* Discussion topics and consent                                       */
/* ------------------------------------------------------------------ */

export const TOPIC_NOTE_MAX_LENGTH = 300;

export function topicTitle(topic: Pick<DiscussionTopic, "area">): string {
  return AREA_INFO[topic.area].topic;
}

/** A topic is in use once it is on an agenda or linked to an action; it can then not be withdrawn. */
export function isTopicInUse(feedback: FeedbackState, topicId: string): boolean {
  return (
    feedback.meetings.some((m) => m.status !== "cancelled" && m.agenda.some((i) => i.topicId === topicId)) ||
    feedback.actions.some((a) => a.source.kind === "topic" && a.source.topicId === topicId)
  );
}

/**
 * The employee's decision about a topic. "share" makes it visible to HR and adds it to new
 * agendas; "keep-private" keeps it to the employee. A shared topic can be made private again
 * only while it is not on an agenda or linked to an action.
 */
export function reviewTopic(
  feedback: FeedbackState,
  topicId: string,
  decision: "share" | "keep-private",
  note: string,
  today: ISODate,
): FeedbackState {
  const topic = feedback.topics.find((t) => t.id === topicId);
  if (!topic || topic.status === "discussed") return feedback;
  if (decision === "share" && topic.status === "shared") return feedback;
  if (decision === "keep-private" && (topic.status === "private" || isTopicInUse(feedback, topicId))) return feedback;

  const trimmed = note.trim().slice(0, TOPIC_NOTE_MAX_LENGTH);
  const next: DiscussionTopic = {
    ...topic,
    status: decision === "share" ? "shared" : "private",
    reviewedAt: today,
  };
  delete next.employeeNote;
  if (decision === "share" && trimmed) next.employeeNote = trimmed;
  return { ...feedback, topics: feedback.topics.map((t) => (t.id === topicId ? next : t)) };
}

/** What anyone other than the employee may see of a topic: the title and the employee's own note. */
export type SharedTopic = {
  id: string;
  caseId: string;
  title: string;
  checkpoint: SurveyCheckpoint;
  status: "shared" | "discussed";
  note?: string;
  sharedOn?: ISODate;
};

export function sharedTopics(feedback: FeedbackState, caseId?: string): SharedTopic[] {
  return feedback.topics
    .filter((t) => (t.status === "shared" || t.status === "discussed") && (!caseId || t.caseId === caseId))
    .map((t) => ({
      id: t.id,
      caseId: t.caseId,
      title: topicTitle(t),
      checkpoint: t.checkpoint,
      status: t.status as "shared" | "discussed",
      ...(t.employeeNote ? { note: t.employeeNote } : {}),
      ...(t.reviewedAt ? { sharedOn: t.reviewedAt } : {}),
    }));
}

/* ------------------------------------------------------------------ */
/* Check-in slots and booking                                          */
/* ------------------------------------------------------------------ */

export const MEETING_TYPE_INFO: Record<
  MeetingType,
  { label: string; hostRole: string; description: string; agenda: readonly string[] }
> = {
  hr: {
    label: "HR check-in",
    hostRole: "HR partner",
    description: "How onboarding is going, policies, admin and wellbeing.",
    agenda: ["How your onboarding is going overall", "Questions about policies, benefits or admin"],
  },
  manager: {
    label: "Manager check-in",
    hostRole: "Hiring manager",
    description: "Priorities, expectations and the support you need.",
    agenda: ["Your priorities until the next checkpoint", "What good looks like in your role", "Support you need"],
  },
  buddy: {
    label: "Buddy chat",
    hostRole: "Onboarding buddy",
    description: "Everyday questions, ways of working and who to ask.",
    agenda: ["Everyday ways of working in the team", "Who to ask for what"],
  },
};

export const SLOT_TIMES = ["09:30", "11:00", "14:00", "15:30"] as const;
export const SLOT_WINDOW_DAYS = 14;
export const MEETING_DURATION_MINUTES = 30;

export function hostFor(onboarding: Pick<OnboardingCase, "hiringManager" | "contacts">, type: MeetingType): string {
  if (type === "hr") return onboarding.contacts.hrPartner.name;
  if (type === "manager") return onboarding.hiringManager;
  return onboarding.contacts.buddy.name;
}

function hash(value: string): number {
  let h = 0;
  for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

function slug(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function slotId(hostName: string, date: ISODate, time: string): string {
  return `${slug(hostName)}--${date}--${time}`;
}

export type Slot = { id: string; hostName: string; date: ISODate; time: string };

/**
 * Fictional availability for a host: on weekdays from tomorrow for 14 days, each host offers
 * two of the four standard times on three fixed weekdays (derived from the name, so it is
 * stable). A slot is identified by host, date and time, so it is shared by every case the
 * host supports.
 */
export function generateSlots(hostName: string, today: ISODate, days = SLOT_WINDOW_DAYS): Slot[] {
  const h = hash(hostName);
  // Monday (1) to Friday (5). Unsigned shifts keep every value in range.
  const weekdays = new Set([1 + (h % 5), 1 + ((h >>> 3) % 5), 1 + ((h >>> 6) % 5)]);
  for (let step = 1; weekdays.size < 3; step++) weekdays.add(1 + ((h + step) % 5));
  const first = SLOT_TIMES[h % SLOT_TIMES.length];
  const second = SLOT_TIMES[(h + 2) % SLOT_TIMES.length];
  const times = [first, second].sort();
  const slots: Slot[] = [];
  for (let offset = 1; offset <= days; offset++) {
    const date = addDays(today, offset);
    const weekday = parseISODate(date)!.getDay();
    if (!weekdays.has(weekday)) continue;
    for (const time of times) slots.push({ id: slotId(hostName, date, time), hostName, date, time });
  }
  return slots;
}

/** A slot is taken by any meeting that is not cancelled, whichever case booked it. */
export function isSlotTaken(meetings: readonly Meeting[], id: string): boolean {
  return meetings.some((m) => m.slotId === id && m.status !== "cancelled");
}

export function availableSlots(
  onboarding: Pick<OnboardingCase, "hiringManager" | "contacts">,
  type: MeetingType,
  meetings: readonly Meeting[],
  today: ISODate,
): Slot[] {
  return generateSlots(hostFor(onboarding, type), today).filter((s) => !isSlotTaken(meetings, s.id));
}

export function upcomingMeetingOfType(
  meetings: readonly Meeting[],
  caseId: string,
  type: MeetingType,
): Meeting | undefined {
  return meetings.find((m) => m.caseId === caseId && m.type === type && m.status === "scheduled");
}

/* ------------------------------------------------------------------ */
/* Agenda                                                              */
/* ------------------------------------------------------------------ */

export const AGENDA_POINT_MAX_LENGTH = 200;
export const MAX_EMPLOYEE_POINTS = 5;

/**
 * The draft agenda for a check-in, built only from shared information: the meeting type,
 * the next milestone, topics the employee agreed to share, and the employee's own points.
 * Survey ratings and comments are never used.
 */
export function buildDraftAgenda(input: {
  onboarding: OnboardingCase;
  type: MeetingType;
  date: ISODate;
  topics: readonly DiscussionTopic[];
  employeePoints: readonly string[];
  idPrefix: string;
}): AgendaItem[] {
  const { onboarding, type, date, idPrefix } = input;
  const items: AgendaItem[] = [];
  const add = (item: Omit<AgendaItem, "id">) => items.push({ id: `${idPrefix}--a${items.length + 1}`, ...item });

  for (const text of MEETING_TYPE_INFO[type].agenda) add({ source: "meeting-type", text, addedBy: "System" });

  const milestone = pickNextMilestone(getMilestones(onboarding, date), date);
  if (milestone) {
    add({
      source: "milestone",
      text: `${milestone.label} milestone (${formatShortDate(milestone.date)}): progress and anything still open`,
      addedBy: "System",
    });
  }

  for (const topic of input.topics) {
    if (topic.caseId !== onboarding.id || topic.status !== "shared") continue;
    add({ source: "topic", text: topicTitle(topic), addedBy: "Shared by the employee", topicId: topic.id });
  }

  for (const point of input.employeePoints.map((p) => p.trim()).filter(Boolean).slice(0, MAX_EMPLOYEE_POINTS)) {
    add({ source: "employee", text: point.slice(0, AGENDA_POINT_MAX_LENGTH), addedBy: "Employee" });
  }
  return items;
}

export type BookResult = "booked" | "slot-taken" | "invalid-slot" | "already-booked" | "case-not-found";

/** Books a fictional slot. The slot must be offered by the host and still free. */
export function bookMeeting(
  feedback: FeedbackState,
  onboarding: OnboardingCase,
  request: { type: MeetingType; slotId: string; employeePoints: readonly string[] },
  today: ISODate,
  id: string,
): { feedback: FeedbackState; result: BookResult; meeting?: Meeting } {
  const slot = generateSlots(hostFor(onboarding, request.type), today).find((s) => s.id === request.slotId);
  if (!slot) return { feedback, result: "invalid-slot" };
  if (isSlotTaken(feedback.meetings, slot.id)) return { feedback, result: "slot-taken" };
  if (upcomingMeetingOfType(feedback.meetings, onboarding.id, request.type)) return { feedback, result: "already-booked" };

  const meeting: Meeting = {
    id,
    caseId: onboarding.id,
    type: request.type,
    slotId: slot.id,
    hostName: slot.hostName,
    date: slot.date,
    time: slot.time,
    durationMinutes: MEETING_DURATION_MINUTES,
    status: "scheduled",
    bookedAt: today,
    agenda: buildDraftAgenda({
      onboarding,
      type: request.type,
      date: slot.date,
      topics: feedback.topics,
      employeePoints: request.employeePoints,
      idPrefix: id,
    }),
  };
  return { feedback: { ...feedback, meetings: [...feedback.meetings, meeting] }, result: "booked", meeting };
}

/** Cancelling frees the slot. The meeting record is kept. */
export function cancelMeeting(feedback: FeedbackState, meetingId: string, today: ISODate): FeedbackState {
  const meeting = feedback.meetings.find((m) => m.id === meetingId);
  if (!meeting || meeting.status !== "scheduled") return feedback;
  return {
    ...feedback,
    meetings: feedback.meetings.map((m) => (m.id === meetingId ? { ...m, status: "cancelled", cancelledAt: today } : m)),
  };
}

/** Adds a shared agenda point to a scheduled meeting. */
export function addAgendaPoint(feedback: FeedbackState, meetingId: string, text: string, addedBy: string): FeedbackState {
  const meeting = feedback.meetings.find((m) => m.id === meetingId);
  const trimmed = text.trim().slice(0, AGENDA_POINT_MAX_LENGTH);
  if (!meeting || meeting.status !== "scheduled" || !trimmed) return feedback;
  const item: AgendaItem = {
    id: `${meeting.id}--a${meeting.agenda.length + 1}`,
    source: addedBy === "Employee" ? "employee" : "participant",
    text: trimmed,
    addedBy,
  };
  return {
    ...feedback,
    meetings: feedback.meetings.map((m) => (m.id === meetingId ? { ...m, agenda: [...m.agenda, item] } : m)),
  };
}

export const OUTCOME_MAX_LENGTH = 1000;

/**
 * Records the agreed outcome (shared) and an optional HR-only note (confidential). Topics on
 * the agenda become "discussed". A meeting can be completed on or after its date.
 */
export function completeMeeting(
  feedback: FeedbackState,
  meetingId: string,
  outcome: string,
  hrNote: string,
  today: ISODate,
): FeedbackState {
  const meeting = feedback.meetings.find((m) => m.id === meetingId);
  const agreed = outcome.trim().slice(0, OUTCOME_MAX_LENGTH);
  if (!meeting || meeting.status !== "scheduled" || !agreed || diffInDays(meeting.date, today) < 0) return feedback;
  const note = hrNote.trim().slice(0, OUTCOME_MAX_LENGTH);
  const topicIds = new Set(meeting.agenda.map((i) => i.topicId).filter(Boolean));
  return {
    ...feedback,
    meetings: feedback.meetings.map((m) =>
      m.id === meetingId
        ? { ...m, status: "completed", outcome: agreed, completedAt: today, ...(note ? { hrNote: note } : {}) }
        : m,
    ),
    topics: feedback.topics.map((t) => (topicIds.has(t.id) ? { ...t, status: "discussed" } : t)),
  };
}

/** The meeting as the employee and other participants see it: without the HR-only note. */
export function toSharedMeeting(meeting: Meeting): Omit<Meeting, "hrNote"> {
  const { hrNote: _hrNote, ...shared } = meeting;
  void _hrNote;
  return shared;
}

export function meetingTitle(meeting: Pick<Meeting, "type">): string {
  return MEETING_TYPE_INFO[meeting.type].label;
}

/* ------------------------------------------------------------------ */
/* Action plans                                                        */
/* ------------------------------------------------------------------ */

export const ACTION_DESCRIPTION_MAX_LENGTH = 200;

export type ActionInput = {
  caseId: string;
  description: string;
  owner: ActionOwner;
  dueDate: ISODate;
  source: ActionSource;
  linkedTaskId?: string;
};

export type ActionError =
  | "description-required"
  | "invalid-due-date"
  | "case-not-found"
  | "source-not-agreed"
  | "task-not-in-case"
  | "duplicates-task";

const normalise = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Creates an action from an agreed outcome (a completed meeting) or a reviewed topic (shared or
 * discussed). It is never created from a rating. An action may link to an existing onboarding
 * task of the same case; an unlinked action that repeats an existing task's title is refused,
 * so tasks are linked rather than duplicated.
 */
export function createAction(
  feedback: FeedbackState,
  cases: readonly OnboardingCase[],
  input: ActionInput,
  today: ISODate,
  id: string,
  by: string,
): { feedback: FeedbackState; error?: ActionError; action?: ActionItem } {
  const description = input.description.trim().slice(0, ACTION_DESCRIPTION_MAX_LENGTH);
  if (!description) return { feedback, error: "description-required" };
  if (!isValidISODate(input.dueDate)) return { feedback, error: "invalid-due-date" };
  const onboarding = cases.find((c) => c.id === input.caseId);
  if (!onboarding) return { feedback, error: "case-not-found" };

  const agreed =
    input.source.kind === "meeting"
      ? feedback.meetings.some(
          (m) => m.id === (input.source as { meetingId: string }).meetingId && m.caseId === input.caseId && m.status === "completed",
        )
      : feedback.topics.some(
          (t) =>
            t.id === (input.source as { topicId: string }).topicId &&
            t.caseId === input.caseId &&
            (t.status === "shared" || t.status === "discussed"),
        );
  if (!agreed) return { feedback, error: "source-not-agreed" };

  if (input.linkedTaskId && !onboarding.tasks.some((t) => t.id === input.linkedTaskId)) {
    return { feedback, error: "task-not-in-case" };
  }
  if (!input.linkedTaskId && onboarding.tasks.some((t) => normalise(t.title) === normalise(description))) {
    return { feedback, error: "duplicates-task" };
  }

  const action: ActionItem = {
    id,
    caseId: input.caseId,
    description,
    owner: input.owner,
    dueDate: input.dueDate,
    status: "Open",
    source: input.source,
    ...(input.linkedTaskId ? { linkedTaskId: input.linkedTaskId } : {}),
    createdAt: today,
    reopenCount: 0,
    followUps: [],
    history: [{ at: today, type: "created", detail: "Action agreed", by }],
  };
  return { feedback: { ...feedback, actions: [...feedback.actions, action] }, action };
}

function updateAction(feedback: FeedbackState, id: string, update: (a: ActionItem) => ActionItem | null): FeedbackState {
  const action = feedback.actions.find((a) => a.id === id);
  if (!action) return feedback;
  const next = update(action);
  if (!next) return feedback;
  return { ...feedback, actions: feedback.actions.map((a) => (a.id === id ? next : a)) };
}

export function setActionStatus(
  feedback: FeedbackState,
  actionId: string,
  status: ActionStatus,
  today: ISODate,
  by: string,
): FeedbackState {
  return updateAction(feedback, actionId, (a) => {
    if (a.status === status) return null;
    const next: ActionItem = {
      ...a,
      status,
      history: [...a.history, { at: today, type: "status", detail: `${a.status} → ${status}`, by }],
    };
    if (status === "Completed") next.completedAt = today;
    else delete next.completedAt;
    return next;
  });
}

export const FOLLOW_UP_LABELS: Record<FollowUpResponse, string> = {
  helped: "Yes, it helped",
  partly: "Partly, it helped",
  "not-helped": "No, it did not help",
};

/** One follow-up per completion: a reopened and completed-again action can be answered again. */
export function canRespondToFollowUp(action: ActionItem): boolean {
  return action.status === "Completed" && action.followUps.length <= action.reopenCount;
}

export function recordFollowUp(
  feedback: FeedbackState,
  actionId: string,
  response: FollowUpResponse,
  today: ISODate,
): FeedbackState {
  return updateAction(feedback, actionId, (a) =>
    canRespondToFollowUp(a)
      ? {
          ...a,
          followUps: [...a.followUps, { at: today, response }],
          history: [...a.history, { at: today, type: "follow-up", detail: FOLLOW_UP_LABELS[response], by: "Employee" }],
        }
      : null,
  );
}

/** Reopening is offered only after a "did not help" follow-up. Earlier history is kept. */
export function canReopen(action: ActionItem): boolean {
  return action.status === "Completed" && action.followUps.at(-1)?.response === "not-helped" && action.followUps.length > action.reopenCount;
}

/** Reopens the action (optionally with a new due date). Earlier history and follow-ups are kept. */
export function reopenAction(
  feedback: FeedbackState,
  actionId: string,
  today: ISODate,
  by: string,
  newDueDate?: ISODate,
): FeedbackState {
  return updateAction(feedback, actionId, (a) => {
    if (!canReopen(a)) return null;
    const dueDate = newDueDate && isValidISODate(newDueDate) ? newDueDate : a.dueDate;
    const next: ActionItem = {
      ...a,
      status: "Open",
      dueDate,
      reopenCount: a.reopenCount + 1,
      history: [
        ...a.history,
        {
          at: today,
          type: "reopened",
          detail:
            dueDate === a.dueDate
              ? "Reopened after follow-up: it did not help"
              : `Reopened after follow-up: it did not help. New due date ${formatShortDate(dueDate)}`,
          by,
        },
      ],
    };
    delete next.completedAt;
    return next;
  });
}

/** Overdue: not completed and the due date is before today. */
export function isActionOverdue(action: ActionItem, today: ISODate): boolean {
  return action.status !== "Completed" && diffInDays(action.dueDate, today) > 0;
}

/* ------------------------------------------------------------------ */
/* Housekeeping and reporting                                          */
/* ------------------------------------------------------------------ */

/** Drops records of deleted cases. Returns the same object when nothing changes. */
export function reconcileFeedback(cases: readonly OnboardingCase[], feedback: FeedbackState): FeedbackState {
  const ids = new Set(cases.map((c) => c.id));
  const keep = <T extends { caseId: string }>(list: T[]) => list.filter((x) => ids.has(x.caseId));
  const next = {
    responses: keep(feedback.responses),
    topics: keep(feedback.topics),
    meetings: keep(feedback.meetings),
    actions: keep(feedback.actions),
  };
  const unchanged = (Object.keys(next) as (keyof FeedbackState)[]).every((k) => next[k].length === feedback[k].length);
  return unchanged ? feedback : next;
}

export const FEEDBACK_KPI_DEFINITIONS = {
  participation:
    "Submitted surveys ÷ all eligible surveys whose checkpoint date is on or before today. Future surveys are excluded; unsubmitted eligible surveys, including expired ones, stay in the denominator.",
  upcoming: "Check-ins with status Scheduled.",
  completed: "Check-ins with an agreed outcome recorded.",
  openActions: "Actions that are Open or In progress. A reopened action counts as open again.",
  overdueActions: "Open or in-progress actions whose due date is before today.",
} as const;

export type FeedbackSummary = {
  participation: { numerator: number; denominator: number; percent: number | null };
  upcomingMeetings: number;
  completedMeetings: number;
  sharedTopics: number;
  openActions: number;
  overdueActions: number;
};

export function getFeedbackSummary(
  cases: readonly OnboardingCase[],
  feedback: FeedbackState,
  today: ISODate,
): FeedbackSummary {
  let opened = 0;
  let submitted = 0;
  for (const c of cases) {
    for (const s of getSurveys(c, feedback.responses, today)) {
      if (s.state === "upcoming") continue;
      opened++;
      if (s.state === "submitted") submitted++;
    }
  }
  const open = feedback.actions.filter((a) => a.status !== "Completed");
  return {
    participation: { numerator: submitted, denominator: opened, percent: opened === 0 ? null : Math.round((submitted / opened) * 100) },
    upcomingMeetings: feedback.meetings.filter((m) => m.status === "scheduled").length,
    completedMeetings: feedback.meetings.filter((m) => m.status === "completed").length,
    sharedTopics: sharedTopics(feedback).filter((t) => t.status === "shared").length,
    openActions: open.length,
    overdueActions: open.filter((a) => isActionOverdue(a, today)).length,
  };
}

export function sortMeetings(meetings: readonly Meeting[]): Meeting[] {
  return [...meetings].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
}

export function actionsForCase(feedback: FeedbackState, caseId: string): ActionItem[] {
  return feedback.actions.filter((a) => a.caseId === caseId).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
