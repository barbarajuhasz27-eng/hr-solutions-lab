import { diffInDays } from "@/lib/dates";
import { AREA_INFO, getSurveys, isActionOverdue, surveyLabel, surveyOpensOn } from "@/lib/feedback";
import { CHECKPOINTS, getModuleSummaries, isAssignmentComplete, isAssignmentOverdue, assignmentStatus, mandatoryLearningCompletion, type Rate } from "@/lib/learning";
import { isCaseActive, isTaskOverdue } from "@/lib/metrics";
import { getCompletionByStage, getOverdueByOwner } from "@/lib/process-intelligence";
import { assessReadiness, READINESS_STATUSES, type ReadinessStatus } from "@/lib/readiness";
import { FEEDBACK_AREAS, SURVEY_CHECKPOINTS, type FeedbackArea, type FeedbackState, type SurveyCheckpoint } from "@/types/feedback";
import type { LearningAssignment, LearningCheckpoint } from "@/types/learning";
import { ONBOARDING_STAGES, type ISODate, type OnboardingCase, type OnboardingStage, type TaskOwner } from "@/types/onboarding";

/*
 * Experience & Process Intelligence: one reporting layer over onboarding, readiness, learning,
 * surveys, check-ins and action plans.
 *
 * Rules that apply to everything in this file:
 *  - Every figure is calculated from the data in the workspace; nothing is estimated.
 *  - Rates carry their numerator and denominator; a zero denominator gives percent = null
 *    ("no data"), never NaN or Infinity.
 *  - Experience ratings are reported only for groups with at least MIN_GROUP_SIZE distinct
 *    employees. Smaller groups are returned without any value or count, so no view can show them.
 *  - Comments, individual ratings and HR-only notes are never read here.
 *  - The reporting cohort is every onboarding case currently in the workspace. There are no
 *    filters, so suppressed groups cannot be reconstructed by narrowing the population.
 */

export const ANALYTICS_DISCLAIMER =
  "Calculated from synthetic demonstration data. Illustrative only — not validated business performance results.";

/** Minimum number of distinct employees before an experience group is shown. */
export const MIN_GROUP_SIZE = 5;

export const EXPERIENCE_KPI_DEFINITIONS = {
  readiness:
    "Active onboardings whose rule-based readiness status is Ready or On track ÷ all active onboardings. Uses the existing readiness rules unchanged; learning is not part of readiness.",
  mandatoryLearning:
    "Completed mandatory assignments due on or before today ÷ all mandatory assignments due on or before today. Assignments with future due dates are excluded.",
  checkInCompletion:
    "Completed check-ins with an agreed outcome ÷ all non-cancelled check-ins dated on or before today. Upcoming check-ins are excluded from the denominator.",
  feedbackParticipation:
    "Submitted surveys ÷ all eligible surveys whose checkpoint date is on or before today. Future surveys are excluded; unsubmitted eligible surveys, including expired ones, stay in the denominator.",
  actionClosure:
    "Completed actions ÷ all actions created in the reporting cohort (every onboarding case in this workspace). Open, in-progress and reopened actions do not count as completed.",
  overdueActions: "Actions that are Open or In progress with a due date strictly before today. Actions due today are not overdue.",
  experienceTrends: `Average rating (1–5) by experience area and checkpoint, from submitted surveys only. A group is shown only when at least ${MIN_GROUP_SIZE} distinct employees contributed; smaller groups are not shown at all.`,
  areaAverages: `For each area, each employee's ratings across checkpoints are averaged first, then averaged across employees, so people with more surveys do not weigh more. Shown only when at least ${MIN_GROUP_SIZE} distinct employees contributed.`,
} as const;

export function rate(numerator: number, denominator: number): Rate {
  return { numerator, denominator, percent: denominator === 0 ? null : Math.round((numerator / denominator) * 100) };
}

/* ------------------------------------------------------------------ */
/* Executive KPIs                                                      */
/* ------------------------------------------------------------------ */

export function readinessRate(cases: readonly OnboardingCase[], today: ISODate): Rate & { mix: Record<ReadinessStatus, number> } {
  const mix = Object.fromEntries(READINESS_STATUSES.map((s) => [s, 0])) as Record<ReadinessStatus, number>;
  const active = cases.filter(isCaseActive);
  for (const c of active) mix[assessReadiness(c, today).status]++;
  return { ...rate(mix.Ready + mix["On track"], active.length), mix };
}

export function checkInCompletion(feedback: FeedbackState, today: ISODate): Rate {
  const due = feedback.meetings.filter((m) => m.status !== "cancelled" && diffInDays(m.date, today) >= 0);
  return rate(due.filter((m) => m.status === "completed" && Boolean(m.outcome)).length, due.length);
}

export function feedbackParticipation(
  cases: readonly OnboardingCase[],
  feedback: FeedbackState,
  today: ISODate,
  checkpoint?: SurveyCheckpoint,
): Rate {
  let eligible = 0;
  let submitted = 0;
  for (const c of cases) {
    for (const s of getSurveys(c, feedback.responses, today)) {
      if (checkpoint && s.checkpoint !== checkpoint) continue;
      if (diffInDays(s.opensOn, today) < 0) continue; // checkpoint date in the future
      eligible++;
      if (s.response) submitted++;
    }
  }
  return rate(submitted, eligible);
}

/** Actions in the cohort: those belonging to a case in the workspace. */
function cohortActions(cases: readonly OnboardingCase[], feedback: FeedbackState) {
  const ids = new Set(cases.map((c) => c.id));
  return feedback.actions.filter((a) => ids.has(a.caseId));
}

export function actionClosureRate(cases: readonly OnboardingCase[], feedback: FeedbackState): Rate {
  const actions = cohortActions(cases, feedback);
  return rate(actions.filter((a) => a.status === "Completed").length, actions.length);
}

export function overdueActions(cases: readonly OnboardingCase[], feedback: FeedbackState, today: ISODate) {
  return cohortActions(cases, feedback).filter((a) => isActionOverdue(a, today));
}

export type ExecutiveOverview = {
  readiness: ReturnType<typeof readinessRate>;
  mandatoryLearning: Rate;
  checkInCompletion: Rate;
  feedbackParticipation: Rate;
  actionClosure: Rate;
  overdueActions: number;
};

export function getExecutiveOverview(
  cases: readonly OnboardingCase[],
  learning: readonly LearningAssignment[],
  feedback: FeedbackState,
  today: ISODate,
): ExecutiveOverview {
  return {
    readiness: readinessRate(cases, today),
    mandatoryLearning: mandatoryLearningCompletion(cohortLearning(cases, learning), today),
    checkInCompletion: checkInCompletion(cohortFeedback(cases, feedback), today),
    feedbackParticipation: feedbackParticipation(cases, feedback, today),
    actionClosure: actionClosureRate(cases, feedback),
    overdueActions: overdueActions(cases, feedback, today).length,
  };
}

function cohortLearning(cases: readonly OnboardingCase[], learning: readonly LearningAssignment[]) {
  const ids = new Set(cases.map((c) => c.id));
  return learning.filter((a) => ids.has(a.caseId));
}

function cohortFeedback(cases: readonly OnboardingCase[], feedback: FeedbackState): FeedbackState {
  const ids = new Set(cases.map((c) => c.id));
  return { ...feedback, meetings: feedback.meetings.filter((m) => ids.has(m.caseId)) };
}

/* ------------------------------------------------------------------ */
/* Employee experience (with small-group suppression)                  */
/* ------------------------------------------------------------------ */

/**
 * A reported group. When suppressed, no average and no employee count are included, so a
 * view cannot reveal anything about the group beyond the fact that it is not shown.
 */
export type ExperienceCell = { shown: true; average: number; employees: number } | { shown: false };

const round1 = (value: number) => Math.round(value * 10) / 10;
const mean = (values: number[]) => values.reduce((s, v) => s + v, 0) / values.length;

function cell(valuesByEmployee: Map<string, number[]>): ExperienceCell {
  if (valuesByEmployee.size < MIN_GROUP_SIZE) return { shown: false };
  const perEmployee = [...valuesByEmployee.values()].map(mean);
  return { shown: true, average: round1(mean(perEmployee)), employees: valuesByEmployee.size };
}

function cohortResponses(cases: readonly OnboardingCase[], feedback: FeedbackState) {
  const ids = new Set(cases.map((c) => c.id));
  return feedback.responses.filter((r) => ids.has(r.caseId));
}

export type ExperienceTrends = {
  /** Average per area for each checkpoint. All areas of a checkpoint share one group of employees. */
  byCheckpoint: { checkpoint: SurveyCheckpoint; label: string; areas: Record<FeedbackArea, ExperienceCell> }[];
  /** Average per area across all checkpoints (employee-level averages first). */
  byArea: { area: FeedbackArea; label: string; cell: ExperienceCell }[];
};

export function getExperienceTrends(cases: readonly OnboardingCase[], feedback: FeedbackState): ExperienceTrends {
  const responses = cohortResponses(cases, feedback);

  const byCheckpoint = SURVEY_CHECKPOINTS.map((checkpoint) => {
    const group = responses.filter((r) => r.checkpoint === checkpoint);
    const areas = Object.fromEntries(
      FEEDBACK_AREAS.map((area) => {
        const values = new Map<string, number[]>();
        for (const r of group) values.set(r.caseId, [...(values.get(r.caseId) ?? []), r.ratings[area]]);
        return [area, cell(values)];
      }),
    ) as Record<FeedbackArea, ExperienceCell>;
    return { checkpoint, label: surveyLabel(checkpoint), areas };
  });

  const byArea = FEEDBACK_AREAS.map((area) => {
    const values = new Map<string, number[]>();
    for (const r of responses) values.set(r.caseId, [...(values.get(r.caseId) ?? []), r.ratings[area]]);
    return { area, label: AREA_INFO[area].label, cell: cell(values) };
  });

  return { byCheckpoint, byArea };
}

export type ParticipationByCheckpoint = { checkpoint: SurveyCheckpoint; label: string; rate: Rate };

export function getParticipationByCheckpoint(
  cases: readonly OnboardingCase[],
  feedback: FeedbackState,
  today: ISODate,
): ParticipationByCheckpoint[] {
  return SURVEY_CHECKPOINTS.map((checkpoint) => ({
    checkpoint,
    label: surveyLabel(checkpoint),
    rate: feedbackParticipation(cases, feedback, today, checkpoint),
  }));
}

/* ------------------------------------------------------------------ */
/* Learning & development                                              */
/* ------------------------------------------------------------------ */

export type LearningByCheckpoint = {
  checkpoint: LearningCheckpoint;
  label: string;
  assigned: number;
  completed: number;
  inProgress: number;
  overdue: number;
  notStarted: number;
};

export function getLearningByCheckpoint(
  cases: readonly OnboardingCase[],
  learning: readonly LearningAssignment[],
  today: ISODate,
): LearningByCheckpoint[] {
  const own = cohortLearning(cases, learning);
  return CHECKPOINTS.map(({ key, label }) => {
    const group = own.filter((a) => a.checkpoint === key);
    const statuses = group.map((a) => assignmentStatus(a, today));
    return {
      checkpoint: key,
      label,
      assigned: group.length,
      completed: statuses.filter((s) => s === "Completed").length,
      inProgress: statuses.filter((s) => s === "In progress").length,
      overdue: statuses.filter((s) => s === "Overdue").length,
      notStarted: statuses.filter((s) => s === "Not started").length,
    };
  });
}

export function getLearningModuleReport(
  cases: readonly OnboardingCase[],
  learning: readonly LearningAssignment[],
  today: ISODate,
) {
  const own = cohortLearning(cases, learning);
  return getModuleSummaries(own, today).map((m) => {
    const mandatory = own.filter((a) => a.moduleId === m.module.id && a.mandatory);
    const due = mandatory.filter((a) => diffInDays(a.dueDate, today) >= 0);
    return {
      ...m,
      mandatoryCompletion: rate(due.filter(isAssignmentComplete).length, due.length),
      overdueMandatory: mandatory.filter((a) => isAssignmentOverdue(a, today)).length,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Check-ins & actions                                                 */
/* ------------------------------------------------------------------ */

export type CheckInReport = {
  completion: Rate;
  upcoming: number;
  completed: number;
  cancelled: number;
  /** Dated on or before today, not cancelled, no outcome recorded yet. */
  awaitingOutcome: number;
  openActions: number;
  overdueActions: number;
  closure: Rate;
  reopenedActions: number;
};

export function getCheckInReport(cases: readonly OnboardingCase[], feedback: FeedbackState, today: ISODate): CheckInReport {
  const scoped = cohortFeedback(cases, feedback);
  const actions = cohortActions(cases, feedback);
  return {
    completion: checkInCompletion(scoped, today),
    upcoming: scoped.meetings.filter((m) => m.status === "scheduled" && diffInDays(m.date, today) < 0).length,
    completed: scoped.meetings.filter((m) => m.status === "completed").length,
    cancelled: scoped.meetings.filter((m) => m.status === "cancelled").length,
    awaitingOutcome: scoped.meetings.filter((m) => m.status === "scheduled" && diffInDays(m.date, today) >= 0).length,
    openActions: actions.filter((a) => a.status !== "Completed").length,
    overdueActions: actions.filter((a) => isActionOverdue(a, today)).length,
    closure: actionClosureRate(cases, feedback),
    reopenedActions: actions.filter((a) => a.reopenCount > 0).length,
  };
}

/* ------------------------------------------------------------------ */
/* Process bottlenecks                                                 */
/* ------------------------------------------------------------------ */

export const BOTTLENECK_DEFINITIONS = {
  overdueTasksByOwner: "Open onboarding tasks past their due date, grouped by the owning team.",
  overdueLearning: "Mandatory learning assignments not completed and past their due date, grouped by module.",
  checkInsNotBooked:
    "Active onboardings where (a) the employee shared a topic that is awaiting discussion and no check-in is scheduled, or (b) the Day 30 checkpoint has passed, the case is within Day 30–90, and no check-in has been held or booked.",
  unresolvedActions: "Actions reopened after a “did not help” follow-up that are not completed yet.",
  stageDelays: "Overdue onboarding tasks per stage, next to the share of already-due tasks completed in that stage.",
} as const;

export type CheckInGap = { caseId: string; employeeName: string; reason: "shared-topic-waiting" | "no-check-in-after-day-30" };

export function getCheckInGaps(cases: readonly OnboardingCase[], feedback: FeedbackState, today: ISODate): CheckInGap[] {
  const gaps: CheckInGap[] = [];
  for (const c of cases.filter(isCaseActive)) {
    const meetings = feedback.meetings.filter((m) => m.caseId === c.id && m.status !== "cancelled");
    const scheduled = meetings.some((m) => m.status === "scheduled");
    const waitingTopic = feedback.topics.some((t) => t.caseId === c.id && t.status === "shared");
    if (waitingTopic && !scheduled) {
      gaps.push({ caseId: c.id, employeeName: c.employeeName, reason: "shared-topic-waiting" });
      continue;
    }
    const day = diffInDays(c.startDate, today);
    const day30 = surveyOpensOn(c.startDate, "day-30");
    if (diffInDays(day30, today) >= 0 && day <= 90 && meetings.length === 0) {
      gaps.push({ caseId: c.id, employeeName: c.employeeName, reason: "no-check-in-after-day-30" });
    }
  }
  return gaps;
}

export type StageDelay = { stage: OnboardingStage; overdue: number; dueCompletion: number | null };

export function getStageDelays(cases: readonly OnboardingCase[], today: ISODate): StageDelay[] {
  const completion = getCompletionByStage(cases, today);
  return ONBOARDING_STAGES.map((stage) => ({
    stage,
    overdue: cases.flatMap((c) => c.tasks).filter((t) => t.stage === stage && isTaskOverdue(t, today)).length,
    dueCompletion: completion.find((s) => s.stage === stage)?.rate ?? null,
  }));
}

export type Bottlenecks = {
  overdueTasksByOwner: { owner: TaskOwner; overdue: number; open: number }[];
  overdueLearningByModule: { moduleId: string; title: string; overdue: number }[];
  checkInGaps: CheckInGap[];
  unresolvedActions: { id: string; caseId: string; description: string; reopenCount: number; overdue: boolean }[];
  stageDelays: StageDelay[];
};

export function getBottlenecks(
  cases: readonly OnboardingCase[],
  learning: readonly LearningAssignment[],
  feedback: FeedbackState,
  today: ISODate,
): Bottlenecks {
  return {
    overdueTasksByOwner: getOverdueByOwner(cases, today)
      .filter((o) => o.overdue > 0)
      .map((o) => ({ owner: o.owner, overdue: o.overdue, open: o.open }))
      .sort((a, b) => b.overdue - a.overdue),
    overdueLearningByModule: getLearningModuleReport(cases, learning, today)
      .filter((m) => m.overdueMandatory > 0)
      .map((m) => ({ moduleId: m.module.id, title: m.module.title, overdue: m.overdueMandatory }))
      .sort((a, b) => b.overdue - a.overdue),
    checkInGaps: getCheckInGaps(cases, feedback, today),
    unresolvedActions: cohortActions(cases, feedback)
      .filter((a) => a.reopenCount > 0 && a.status !== "Completed")
      .map((a) => ({ id: a.id, caseId: a.caseId, description: a.description, reopenCount: a.reopenCount, overdue: isActionOverdue(a, today) })),
    stageDelays: getStageDelays(cases, today),
  };
}

