/**
 * Thin M0 adapter between the existing Activity/Action engine and the new application shell.
 *
 * It only reads existing data through existing engine functions (`getReadiness`, `getActionDueAt`,
 * `isActionResolved`). It adds no domain rules of its own: the exception strip and the filtered
 * Today lists are views over the same data the Operations Radar showed before.
 */
import { getActionDueAt, getReadiness, isActionResolved } from "./engine";
import type { Activity, ActionInstance, Readiness } from "./model";

export type ExceptionFilter = "overdue" | "at-risk" | "waiting";

export const EXCEPTION_FILTERS: { id: ExceptionFilter; label: string; short: string; description: string }[] = [
  { id: "overdue", label: "Overdue", short: "Overdue", description: "Unresolved tasks past their due time" },
  { id: "at-risk", label: "At risk", short: "At risk", description: "Occurrences with readiness At risk or Recovery" },
  { id: "waiting", label: "Waiting on others", short: "Waiting", description: "Tasks on a Waiting hold" },
];

/** Query parameter on Today that selects an exception filter, e.g. `/?show=waiting`. */
export const FILTER_PARAM = "show";

export function parseExceptionFilter(value: string | null | undefined): ExceptionFilter | null {
  return EXCEPTION_FILTERS.some((filter) => filter.id === value) ? (value as ExceptionFilter) : null;
}

export function filterHref(filter: ExceptionFilter): string {
  return `/?${FILTER_PARAM}=${filter}`;
}

export function occurrenceHref(activityId: string): string {
  return `/o/${encodeURIComponent(activityId)}`;
}

export function recoveryHref(activityId: string): string {
  return `${occurrenceHref(activityId)}/recovery`;
}

export interface TaskRef {
  activity: Activity;
  action: ActionInstance;
  dueAt: Date;
}

function taskRefs(activities: Activity[], include: (action: ActionInstance, dueAt: Date) => boolean): TaskRef[] {
  return activities
    .flatMap((activity) =>
      activity.actions.map((action) => ({
        activity,
        action,
        dueAt: getActionDueAt(activity.startsAt, action.dueOffsetMinutes),
      })),
    )
    .filter((ref) => include(ref.action, ref.dueAt))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

/** Unresolved tasks whose due time has passed (same rule as the former "Open overdue actions" count). */
export function getOverdueTasks(activities: Activity[], now: Date): TaskRef[] {
  return taskRefs(activities, (action, dueAt) => !isActionResolved(action) && dueAt.getTime() < now.getTime());
}

/** Tasks on a Waiting hold. */
export function getWaitingTasks(activities: Activity[]): TaskRef[] {
  return taskRefs(activities, (action) => action.status === "waiting");
}

/** Activities whose existing readiness is At risk or Recovery, earliest start first. */
export function getAtRiskActivities(activities: Activity[], now: Date): { activity: Activity; readiness: Readiness }[] {
  return activities
    .map((activity) => ({ activity, readiness: getReadiness(activity, now) }))
    .filter((item) => item.readiness.status === "at-risk" || item.readiness.status === "recovery")
    .sort((a, b) => new Date(a.activity.startsAt).getTime() - new Date(b.activity.startsAt).getTime());
}

export function getExceptionCounts(activities: Activity[], now: Date): Record<ExceptionFilter, number> {
  return {
    overdue: getOverdueTasks(activities, now).length,
    "at-risk": getAtRiskActivities(activities, now).length,
    waiting: getWaitingTasks(activities).length,
  };
}
