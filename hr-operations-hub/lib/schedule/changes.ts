/**
 * Schedule changes (§6.6), work-calendar changes (§6.7) and drift decisions.
 *
 * Snapshot rule (§4.3): started, closed and skipped occurrences are never regenerated. Only not-started
 * occurrences are recalculated; a started occurrence whose rule now gives another date gets a drift
 * suggestion that the user applies or keeps.
 *
 * Pure: every function returns a new store and throws a `DomainError` for an invalid change.
 */
import { isIsoDate, localDateOf } from "../calendar/dates";
import { affectsWorkingDays, calendarProblems } from "../calendar/work-calendar";
import { DomainError } from "../domain/errors";
import { findPlaybook, historyEvent, instantiateOccurrence, isClosed, isNotStarted, isTaskResolved, resolveDueAt } from "../domain/occurrence";
import type {
  HistoryDetail,
  ISODate,
  ISODateTime,
  Occurrence,
  Operation,
  Playbook,
  PublicHoliday,
  Schedule,
  ScheduleVersion,
  StoreV3,
  WorkCalendar,
} from "../domain/types";
import { resolvePeriodKeyAnchor, scheduleProblems, scheduleVersions } from "./rules";

export interface ChangeContext {
  now: ISODateTime;
  actorId: string;
}

export type ScheduleChange = Partial<Pick<Schedule, "rule" | "time" | "interval" | "weekendShift" | "anchorPeriodOffset">>;

export type CalendarChange = Partial<Pick<WorkCalendar, "workingWeek" | "workingHours" | "publicHolidays" | "companyClosures">>;

export type DriftKind = "calendar" | "schedule";

const driftField = (kind: DriftKind): "calendarDrift" | "scheduleDrift" => (kind === "calendar" ? "calendarDrift" : "scheduleDrift");

function without<T extends object, K extends keyof T>(value: T, ...keys: K[]): Omit<T, K> {
  const copy = { ...value };
  for (const key of keys) delete copy[key];
  return copy;
}

/** The rule date an occurrence was generated for: before a manual move, its original anchor. */
function ruleAnchorOf(occurrence: Occurrence): ISODateTime {
  return occurrence.originalAnchorAt ?? occurrence.anchorAt;
}

/**
 * Due dates of unresolved tasks recalculated for a new anchor (§6.5 move semantics). Resolved tasks keep
 * theirs. A task without a template in the playbook keeps its distance to the anchor.
 */
export function rescheduleTasks(occurrence: Occurrence, playbook: Playbook | undefined, anchorAt: ISODateTime, calendar: WorkCalendar): Occurrence["tasks"] {
  const delta = new Date(anchorAt).getTime() - new Date(occurrence.anchorAt).getTime();
  return occurrence.tasks.map((task) => {
    if (isTaskResolved(task)) return task;
    const template = playbook?.tasks.find((item) => item.id === task.id);
    const dueAt = template ? resolveDueAt(anchorAt, template, calendar) : new Date(new Date(task.dueAt).getTime() + delta).toISOString();
    return { ...task, dueAt };
  });
}

/** A not-started occurrence regenerated from its operation and playbook with a new anchor and/or calendar. */
function regenerate(occurrence: Occurrence, operation: Operation, playbook: Playbook, anchorAt: ISODateTime, calendar: WorkCalendar, ctx: ChangeContext, reason: string): Occurrence {
  return instantiateOccurrence({
    operation,
    playbook,
    periodKey: occurrence.periodKey,
    anchorAt,
    location: occurrence.eventDetails?.location,
    calendar,
    now: ctx.now,
    actorId: ctx.actorId,
    generatedDetail: { reason },
  });
}

const sameTimeline = (a: Occurrence, b: Occurrence) =>
  a.anchorAt === b.anchorAt && a.tasks.length === b.tasks.length && a.tasks.every((task, index) => task.dueAt === b.tasks[index].dueAt);

// ---------------------------------------------------------------------------
// §6.6 Schedule change
// ---------------------------------------------------------------------------

/** The schedule after a change effective from `effectiveFrom`, with a new `ScheduleVersion`. */
export function scheduleWithChange(schedule: Schedule, change: ScheduleChange, effectiveFrom: ISODate): Schedule {
  if (!isIsoDate(effectiveFrom)) throw new DomainError("invalid-date", effectiveFrom);
  const next = { ...schedule, ...structuredClone(change) };
  const version: ScheduleVersion = {
    effectiveFrom,
    frequency: next.frequency,
    interval: next.interval,
    rule: next.rule,
    anchorPeriodOffset: next.anchorPeriodOffset,
    time: next.time,
    weekendShift: next.weekendShift,
  };
  // A change effective on or before an earlier version's date replaces that version.
  const versions = [...scheduleVersions(schedule).filter((item) => item.effectiveFrom < effectiveFrom), version];
  const result: Schedule = { ...next, versions };
  const problems = scheduleProblems(result);
  if (problems.length) throw new DomainError("invalid-schedule", problems.join(", "));
  return result;
}

/**
 * Applies a schedule change (§6.6):
 * - occurrences whose rule date is before `effectiveFrom`, and closed or skipped ones: untouched;
 * - not-started occurrences on or after `effectiveFrom`: regenerated with the new rule;
 * - started ones on or after `effectiveFrom`: kept, with `scheduleDrift` when the new rule gives another date.
 * Later periods are generated with the new rule by the next engine step.
 */
export function applyScheduleChange(store: StoreV3, operationId: string, change: ScheduleChange, effectiveFrom: ISODate, ctx: ChangeContext): { store: StoreV3; touched: string[] } {
  const operation = store.operations.find((item) => item.id === operationId);
  if (!operation) throw new DomainError("operation-not-found", operationId);
  if (!operation.schedule) throw new DomainError("not-recurring", operationId);
  const schedule = scheduleWithChange(operation.schedule, change, effectiveFrom);
  const updated: Operation = { ...operation, schedule };
  const playbook = findPlaybook(store, operation.playbookId, operation.playbookVersion);
  const touched: string[] = [];

  const occurrences = store.occurrences.map((occurrence) => {
    if (occurrence.operationId !== operationId || isClosed(occurrence)) return occurrence;
    if (localDateOf(ruleAnchorOf(occurrence)) < effectiveFrom) return occurrence;
    const anchor = resolvePeriodKeyAnchor(schedule, occurrence.periodKey, store.calendar);
    if (isNotStarted(occurrence)) {
      // A period that the new rule cannot place (out of range, off the interval) is left as it is.
      if (!anchor?.ok || !playbook || anchor.anchorAt === occurrence.anchorAt) return occurrence;
      touched.push(occurrence.id);
      return regenerate(occurrence, updated, playbook, anchor.anchorAt, store.calendar, ctx, "schedule-changed");
    }
    const drift = anchor?.ok && anchor.anchorAt !== occurrence.anchorAt ? anchor.anchorAt : undefined;
    if (drift === occurrence.scheduleDrift) return occurrence;
    touched.push(occurrence.id);
    return drift ? { ...occurrence, scheduleDrift: drift } : without(occurrence, "scheduleDrift");
  });

  return {
    store: { ...store, modified: true, operations: store.operations.map((item) => (item.id === operationId ? updated : item)), occurrences },
    touched,
  };
}

// ---------------------------------------------------------------------------
// §6.7 Work-calendar change
// ---------------------------------------------------------------------------

/**
 * The calendar after a change. A holiday keeps its `verified` flag only when the same date and name were
 * already verified; new or edited entries are unverified (§6.1: verification is an explicit, separate step).
 */
export function calendarWithChange(calendar: WorkCalendar, change: CalendarChange, now: ISODateTime): WorkCalendar {
  const next: WorkCalendar = { ...calendar, ...structuredClone(change), updatedAt: now };
  if (change.publicHolidays) {
    const verified = new Set(calendar.publicHolidays.filter((holiday) => holiday.verified).map((holiday) => `${holiday.date}|${holiday.name}`));
    next.publicHolidays = change.publicHolidays
      .map((holiday): PublicHoliday => ({ ...holiday, verified: verified.has(`${holiday.date}|${holiday.name}`) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
  if (change.companyClosures) next.companyClosures = [...next.companyClosures].sort((a, b) => a.date.localeCompare(b.date));
  if (change.workingWeek) next.workingWeek = [...next.workingWeek].sort((a, b) => a - b);
  const problems = calendarProblems(next);
  if (problems.length) throw new DomainError("invalid-calendar", problems.join(", "));
  return next;
}

/**
 * Applies a work-calendar change (§6.7):
 * - working hours only: dates are not recalculated (§6.1a, T21);
 * - not-started occurrences: anchor (from the rule, unless moved manually) and task due dates recalculated;
 * - started recurring occurrences whose rule now gives another anchor: `calendarDrift` set, otherwise cleared;
 * - closed and skipped occurrences: never recalculated.
 */
export function applyCalendarChange(store: StoreV3, change: CalendarChange, ctx: ChangeContext): { store: StoreV3; touched: string[] } {
  const calendar = calendarWithChange(store.calendar, change, ctx.now);
  const touched: string[] = [];
  if (!affectsWorkingDays(store.calendar, calendar)) return { store: { ...store, modified: true, calendar }, touched };
  const operations = new Map(store.operations.map((operation) => [operation.id, operation] as const));

  const occurrences = store.occurrences.map((occurrence) => {
    const operation = operations.get(occurrence.operationId);
    if (!operation || isClosed(occurrence)) return occurrence;
    const ruleAnchor = operation.schedule ? resolvePeriodKeyAnchor(operation.schedule, occurrence.periodKey, calendar) : null;
    if (isNotStarted(occurrence)) {
      const playbook = findPlaybook(store, occurrence.playbookId, occurrence.playbookVersion);
      if (!playbook) return occurrence;
      const anchorAt = !occurrence.originalAnchorAt && ruleAnchor?.ok ? ruleAnchor.anchorAt : occurrence.anchorAt;
      const regenerated = regenerate(occurrence, operation, playbook, anchorAt, calendar, ctx, "calendar-changed");
      if (sameTimeline(regenerated, occurrence)) return occurrence;
      touched.push(occurrence.id);
      // A manually moved anchor stays moved; the rule date it came from is kept.
      return occurrence.originalAnchorAt ? { ...regenerated, originalAnchorAt: occurrence.originalAnchorAt } : regenerated;
    }
    if (!operation.schedule) return occurrence;
    const drift = ruleAnchor?.ok && ruleAnchor.anchorAt !== ruleAnchorOf(occurrence) && ruleAnchor.anchorAt !== occurrence.anchorAt ? ruleAnchor.anchorAt : undefined;
    if (drift === occurrence.calendarDrift) return occurrence;
    touched.push(occurrence.id);
    return drift ? { ...occurrence, calendarDrift: drift } : without(occurrence, "calendarDrift");
  });

  return { store: { ...store, modified: true, calendar, occurrences }, touched };
}

// ---------------------------------------------------------------------------
// Drift decisions
// ---------------------------------------------------------------------------

/**
 * Apply: moves the anchor to the suggested date with the move semantics of §6.5 (unresolved tasks get new
 * due dates) and logs `calendar-drift-applied` (calendar) or `moved` (schedule). Keep: clears the suggestion
 * without moving and logs `drift-kept`.
 */
export function decideDrift(store: StoreV3, occurrenceId: string, kind: DriftKind, decision: "apply" | "keep", ctx: ChangeContext): StoreV3 {
  const occurrence = store.occurrences.find((item) => item.id === occurrenceId);
  if (!occurrence) throw new DomainError("occurrence-not-found", occurrenceId);
  if (isClosed(occurrence)) throw new DomainError("occurrence-closed", occurrenceId);
  const field = driftField(kind);
  const suggested = occurrence[field];
  if (!suggested) throw new DomainError("no-drift", occurrenceId);
  const base = without(occurrence, field);

  let next: Occurrence;
  if (decision === "keep") {
    next = { ...base, history: [...occurrence.history, historyEvent(occurrence, "drift-kept", ctx.now, ctx.actorId, { source: kind, suggested, anchorAt: occurrence.anchorAt })] };
  } else {
    const playbook = findPlaybook(store, occurrence.playbookId, occurrence.playbookVersion);
    const detail: HistoryDetail = kind === "calendar" ? { from: occurrence.anchorAt, to: suggested } : { from: occurrence.anchorAt, to: suggested, reason: "schedule-changed" };
    // The anchor now equals the rule date, so there is no manual move left to remember.
    const moved = without(base, "originalAnchorAt");
    next = {
      ...moved,
      anchorAt: suggested,
      tasks: rescheduleTasks(occurrence, playbook, suggested, store.calendar),
      history: [...occurrence.history, historyEvent(occurrence, kind === "calendar" ? "calendar-drift-applied" : "moved", ctx.now, ctx.actorId, detail)],
    };
  }
  return { ...store, modified: true, occurrences: store.occurrences.map((item) => (item.id === occurrenceId ? next : item)) };
}
