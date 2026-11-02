import { addDays } from "@/lib/dates";
import {
  availableSlots,
  bookMeeting,
  buildDraftAgenda,
  completeMeeting,
  createAction,
  EMPTY_FEEDBACK,
  hostFor,
  MEETING_DURATION_MINUTES,
  recordFollowUp,
  reopenAction,
  reviewTopic,
  setActionStatus,
  slotId,
  submitSurvey,
  surveyOpensOn,
} from "@/lib/feedback";
import type { FeedbackArea, FeedbackState, Meeting, MeetingType, SurveyCheckpoint } from "@/types/feedback";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

/*
 * Synthetic feedback for the demo cases. All ratings, comments, meetings and actions are
 * fictional. The data is built through the same transitions the app uses, dated relative to
 * today, so every rule (survey windows, topic consent, agreed sources, follow-ups) holds.
 */

type Ratings = Record<FeedbackArea, number>;
const r = (role: number, learning: number, manager: number, team: number, tools: number): Ratings => ({
  "role-clarity": role,
  "learning-development": learning,
  "manager-support": manager,
  "team-integration": team,
  "tools-resources": tools,
});

const HR_BY = "HR (demo)";

export function createSeedFeedback(cases: readonly OnboardingCase[], today: ISODate): FeedbackState {
  let fb: FeedbackState = EMPTY_FEEDBACK;
  const byId = new Map(cases.map((c) => [c.id, c]));

  /** Submits on the day after the survey opened (or today if it opened today). */
  const survey = (c: OnboardingCase, checkpoint: SurveyCheckpoint, ratings: Ratings, comment = "", lag = 1) => {
    const opens = surveyOpensOn(c.startDate, checkpoint);
    const on = addDays(opens, lag) > today ? today : addDays(opens, lag);
    fb = submitSurvey(fb, c, checkpoint, ratings, comment, on).feedback;
  };

  const topicId = (caseId: string, checkpoint: SurveyCheckpoint, area: FeedbackArea) =>
    `${caseId}--survey--${checkpoint}--topic--${area}`;

  /** A meeting in the past: built from the agenda rules, then completed with an agreed outcome. */
  const pastMeeting = (
    c: OnboardingCase,
    type: MeetingType,
    daysAgo: number,
    time: string,
    outcome: string,
    hrNote = "",
    employeePoints: string[] = [],
  ): string => {
    const id = `seed-${c.id}-${type}-1`;
    const date = addDays(today, -daysAgo);
    const host = hostFor(c, type);
    const meeting: Meeting = {
      id,
      caseId: c.id,
      type,
      slotId: slotId(host, date, time),
      hostName: host,
      date,
      time,
      durationMinutes: MEETING_DURATION_MINUTES,
      status: "scheduled",
      bookedAt: addDays(date, -5),
      agenda: buildDraftAgenda({ onboarding: c, type, date, topics: fb.topics, employeePoints, idPrefix: id }),
    };
    fb = { ...fb, meetings: [...fb.meetings, meeting] };
    fb = completeMeeting(fb, id, outcome, hrNote, date);
    return id;
  };

  const action = (
    c: OnboardingCase,
    id: string,
    input: Omit<Parameters<typeof createAction>[2], "caseId">,
    createdDaysAgo: number,
  ) => {
    fb = createAction(fb, cases, { ...input, caseId: c.id }, addDays(today, -createdDaysAgo), id, HR_BY).feedback;
  };

  // Sofia Marín (day 47): two surveys, a shared topic, a completed HR check-in and a helpful action.
  const sofia = byId.get("demo-sofia-marin");
  if (sofia) {
    survey(sofia, "day-7", r(4, 4, 5, 4, 4));
    survey(sofia, "day-30", r(4, 4, 4, 3, 2), "Getting access to the reporting workspace took longer than I expected.");
    fb = reviewTopic(fb, topicId(sofia.id, "day-30", "tools-resources"), "share", "Access to the reporting workspace", addDays(today, -16));
    const meetingId = pastMeeting(
      sofia,
      "hr",
      12,
      "11:00",
      "Agreed that HR follows up on the reporting workspace access and arranges a short walkthrough with the analytics team.",
      "Check whether other Finance starters had the same access delay.",
    );
    const access = sofia.tasks.find((t) => t.templateKey === "system-access");
    action(
      sofia,
      "seed-action-sofia-1",
      {
        description: "Arrange a reporting workspace walkthrough with the analytics team",
        owner: "HR",
        dueDate: addDays(today, -5),
        source: { kind: "meeting", meetingId },
        ...(access ? { linkedTaskId: access.id } : {}),
      },
      12,
    );
    fb = setActionStatus(fb, "seed-action-sofia-1", "Completed", addDays(today, -7), HR_BY);
    fb = recordFollowUp(fb, "seed-action-sofia-1", "helped", addDays(today, -6));
  }

  // Lena Fischer (day 95): four surveys, a discussed topic and an action reopened after "did not help".
  const lena = byId.get("demo-lena-fischer");
  if (lena) {
    survey(lena, "day-7", r(4, 5, 4, 4, 4));
    survey(lena, "day-30", r(4, 4, 3, 4, 4));
    survey(lena, "day-60", r(4, 4, 2, 4, 4), "Our 1:1s keep moving and I am not sure what to prioritise.");
    fb = reviewTopic(fb, topicId(lena.id, "day-60", "manager-support"), "share", "Regular time with my manager", addDays(today, -34));
    survey(lena, "day-90", r(4, 4, 3, 5, 4));
    const meetingId = pastMeeting(
      lena,
      "manager",
      30,
      "14:00",
      "Agreed on a fixed fortnightly 1:1 and a short written list of priorities for the next month.",
    );
    action(
      lena,
      "seed-action-lena-1",
      { description: "Set up a fixed fortnightly 1:1", owner: "Hiring manager", dueDate: addDays(today, -20), source: { kind: "meeting", meetingId } },
      30,
    );
    fb = setActionStatus(fb, "seed-action-lena-1", "Completed", addDays(today, -22), HR_BY);
    fb = recordFollowUp(fb, "seed-action-lena-1", "not-helped", addDays(today, -10));
    fb = reopenAction(fb, "seed-action-lena-1", addDays(today, -10), "Employee", addDays(today, 10));
  }

  // Marcus Bell (day 25): two suggested topics not yet reviewed (visible to Marcus only) and an upcoming check-in.
  const marcus = byId.get("demo-marcus-bell");
  if (marcus) {
    survey(marcus, "day-7", r(3, 4, 2, 2, 4), "Still finding my feet with the team rituals.");
    const slot = availableSlots(marcus, "manager", fb.meetings, today)[1];
    if (slot) {
      fb = bookMeeting(
        fb,
        marcus,
        { type: "manager", slotId: slot.id, employeePoints: ["Planning my first team offsite"] },
        addDays(today, -1),
        "seed-marcus-bell-manager-1",
      ).feedback;
    }
  }

  // Inês Duarte (day 40): Day 30 survey still open, a completed buddy chat, an overdue action and a shared topic.
  const ines = byId.get("demo-ines-duarte");
  if (ines) {
    survey(ines, "day-7", r(4, 3, 4, 4, 2));
    const meetingId = pastMeeting(
      ines,
      "buddy",
      20,
      "15:30",
      "Agreed that Inês joins the weekly design critique to meet more of the team.",
      "",
      ["How design reviews work here"],
    );
    action(
      ines,
      "seed-action-ines-1",
      { description: "Join the weekly design critique", owner: "Employee", dueDate: addDays(today, -3), source: { kind: "meeting", meetingId } },
      20,
    );
    fb = setActionStatus(fb, "seed-action-ines-1", "In progress", addDays(today, -15), "Employee");
    // Shared after the buddy chat, so it waits for the next check-in.
    fb = reviewTopic(fb, topicId(ines.id, "day-7", "tools-resources"), "share", "A licence for the prototyping tool", addDays(today, -5));
  }

  // Rafael Costa (day 110, onboarding completed): four surveys without comments and no topics.
  // With him, the Day 7 group has five distinct employees, the minimum for showing experience trends.
  const rafael = byId.get("demo-rafael-costa");
  if (rafael) {
    survey(rafael, "day-7", r(3, 4, 4, 3, 4));
    survey(rafael, "day-30", r(4, 4, 4, 4, 3));
    survey(rafael, "day-60", r(4, 5, 4, 4, 4));
    survey(rafael, "day-90", r(5, 4, 4, 5, 4));
  }

  // Daniel Okafor (day 8): the Day 7 survey has just opened. Nothing else, so the demo flow starts here.
  return fb;
}
