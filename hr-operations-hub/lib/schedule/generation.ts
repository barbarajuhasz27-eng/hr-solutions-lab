/**
 * Generation, activation and projection (§6.4).
 *
 * - Generation horizon: weekly operations up to 90 days ahead; monthly the current and next two periods;
 *   quarterly and annual the current and next period. "Current" is the period that contains today's
 *   Europe/Vienna date, counted on the period in which the anchor falls, so with `anchorPeriodOffset: 1` the
 *   October report delivered in November is November's current deliverable.
 * - Idempotent: occurrence id = `operationId:periodKey`; an id that exists is never generated again.
 * - Only `active` operations generate; nothing before `startDate` or after `endDate`. Pausing keeps what was
 *   generated.
 * - Activation: `scheduled` → `active` at the earlier of `anchor − leadTime` and the first task due date,
 *   with exactly one `activated` event.
 * - Projection: occurrences beyond what is stored are computed on demand, never stored, and have no tasks.
 *
 * Pure: `now` and the actor are passed in.
 */
import { addCalendarDays, compareIsoDates, localDateOf } from "../calendar/dates";
import { addPeriods, periodOfDate, type Period, type RuleDateIssue } from "../calendar/working-days";
import { DomainError } from "../domain/errors";
import { activateIfDue, findPlaybook, instantiateOccurrence } from "../domain/occurrence";
import type { ISODate, ISODateTime, Occurrence, Operation, Schedule, StoreV3 } from "../domain/types";
import { resolvePeriodAnchor } from "./rules";

export const WEEKLY_HORIZON_DAYS = 90;
/** Periods generated after the current one, by frequency (weekly uses days instead). */
export const PERIODS_AHEAD: Record<Exclude<Schedule["frequency"], "weekly">, number> = { monthly: 2, quarterly: 1, annually: 1 };

export interface GenerationIssue {
  operationId: string;
  periodKey: string;
  /** Rule issues mean the occurrence is flagged and not generated (§6.2). */
  issue: RuleDateIssue | "playbook-not-found" | "backup-required";
}

export interface AdvanceResult {
  /** The same object as the input when nothing changed. */
  store: StoreV3;
  generated: string[];
  activated: string[];
  issues: GenerationIssue[];
}

/** Covered periods whose anchors are inside the generation horizon for `today`. */
export function horizonPeriods(schedule: Schedule, today: ISODate): Period[] {
  const offset = schedule.anchorPeriodOffset;
  const currentAnchorPeriod = periodOfDate(schedule.frequency, today);
  if (schedule.frequency !== "weekly") {
    return Array.from({ length: PERIODS_AHEAD[schedule.frequency] + 1 }, (_, index) => addPeriods(currentAnchorPeriod, index - offset));
  }
  const last = addCalendarDays(today, WEEKLY_HORIZON_DAYS);
  const lastAnchorPeriod = periodOfDate("weekly", last);
  const periods: Period[] = [];
  for (let anchorPeriod = currentAnchorPeriod, i = 0; i < 20; i += 1, anchorPeriod = addPeriods(anchorPeriod, 1)) {
    periods.push(addPeriods(anchorPeriod, -offset));
    if (anchorPeriod.year === lastAnchorPeriod.year && anchorPeriod.index === lastAnchorPeriod.index) break;
  }
  return periods;
}

function isRuleIssue(issue: string): issue is RuleDateIssue {
  return issue !== "interval-skip" && issue !== "before-start" && issue !== "after-end";
}

/** New occurrences for one operation inside the horizon. Existing ids are skipped. */
export function generateForOperation(
  store: Pick<StoreV3, "calendar" | "playbooks" | "occurrences">,
  operation: Operation,
  now: ISODateTime,
  actorId: string,
): { occurrences: Occurrence[]; issues: GenerationIssue[] } {
  const schedule = operation.schedule;
  if (!schedule || operation.status !== "active") return { occurrences: [], issues: [] };
  const today = localDateOf(now);
  const weeklyLimit = addCalendarDays(today, WEEKLY_HORIZON_DAYS);
  const existing = new Set(store.occurrences.map((occurrence) => occurrence.id));
  const occurrences: Occurrence[] = [];
  const issues: GenerationIssue[] = [];
  const playbook = findPlaybook(store, operation.playbookId, operation.playbookVersion);

  for (const covered of horizonPeriods(schedule, today)) {
    const anchor = resolvePeriodAnchor(schedule, covered, store.calendar);
    if (!anchor.ok) {
      if (isRuleIssue(anchor.issue)) issues.push({ operationId: operation.id, periodKey: anchor.periodKey, issue: anchor.issue });
      continue;
    }
    if (schedule.frequency === "weekly" && compareIsoDates(anchor.date, weeklyLimit) > 0) continue;
    const id = `${operation.id}:${anchor.periodKey}`;
    if (existing.has(id)) continue;
    if (!playbook) {
      issues.push({ operationId: operation.id, periodKey: anchor.periodKey, issue: "playbook-not-found" });
      continue;
    }
    try {
      occurrences.push(instantiateOccurrence({
        operation,
        playbook,
        periodKey: anchor.periodKey,
        anchorAt: anchor.anchorAt,
        calendar: store.calendar,
        now,
        actorId,
      }));
      existing.add(id);
    } catch (error) {
      if (error instanceof DomainError && error.code === "backup-required") {
        issues.push({ operationId: operation.id, periodKey: anchor.periodKey, issue: "backup-required" });
        continue;
      }
      throw error;
    }
  }
  return { occurrences, issues };
}

/** Activates every `scheduled` occurrence whose lead time has started. */
export function activateOccurrences(store: StoreV3, now: ISODateTime, actorId: string): { occurrences: Occurrence[]; activated: string[] } {
  const activated: string[] = [];
  const occurrences = store.occurrences.map((occurrence) => {
    if (occurrence.status !== "scheduled") return occurrence;
    const playbook = findPlaybook(store, occurrence.playbookId, occurrence.playbookVersion);
    if (!playbook) return occurrence;
    const next = activateIfDue(occurrence, playbook, store.calendar, now, actorId);
    if (next !== occurrence) activated.push(occurrence.id);
    return next;
  });
  return { occurrences, activated };
}

/**
 * One engine step, run on app load and on each clock tick: generate inside the horizon, then activate.
 * Automatic steps do not mark the demo as modified by the visitor.
 */
export function advanceSchedule(store: StoreV3, now: ISODateTime, actorId: string): AdvanceResult {
  const generated: Occurrence[] = [];
  const issues: GenerationIssue[] = [];
  for (const operation of store.operations) {
    const result = generateForOperation({ ...store, occurrences: [...store.occurrences, ...generated] }, operation, now, actorId);
    generated.push(...result.occurrences);
    issues.push(...result.issues);
  }
  const withGenerated: StoreV3 = generated.length ? { ...store, occurrences: [...store.occurrences, ...generated] } : store;
  const { occurrences, activated } = activateOccurrences(withGenerated, now, actorId);
  if (generated.length === 0 && activated.length === 0) return { store, generated: [], activated: [], issues };
  return {
    store: { ...withGenerated, occurrences },
    generated: generated.map((occurrence) => occurrence.id),
    activated,
    issues,
  };
}

export interface ProjectedOccurrence {
  /** Marks a calculated, unstored occurrence; M7 draws these hatched. */
  projected: true;
  id: string;
  operationId: string;
  periodKey: string;
  anchorAt: ISODateTime;
  anchorDate: ISODate;
  /** The rule date before a weekend shift. */
  nominalDate: ISODate;
  shifted: boolean;
}

/**
 * Occurrences of active recurring operations whose anchors fall within `from`…`to` (local dates,
 * inclusive) and that are not stored. Nothing is written; projected occurrences have no tasks.
 */
export function projectOccurrences(store: Pick<StoreV3, "operations" | "occurrences" | "calendar">, from: ISODate, to: ISODate): ProjectedOccurrence[] {
  const stored = new Set(store.occurrences.map((occurrence) => occurrence.id));
  const projected: ProjectedOccurrence[] = [];
  for (const operation of store.operations) {
    const schedule = operation.schedule;
    if (!schedule || operation.status !== "active") continue;
    let covered = addPeriods(periodOfDate(schedule.frequency, from), -1 - schedule.anchorPeriodOffset);
    for (let i = 0; i < 600; i += 1, covered = addPeriods(covered, 1)) {
      const anchor = resolvePeriodAnchor(schedule, covered, store.calendar);
      if (!anchor.ok) {
        if (anchor.issue === "after-end") break;
        continue;
      }
      if (compareIsoDates(anchor.date, to) > 0) break;
      const id = `${operation.id}:${anchor.periodKey}`;
      if (compareIsoDates(anchor.date, from) < 0 || stored.has(id)) continue;
      projected.push({
        projected: true,
        id,
        operationId: operation.id,
        periodKey: anchor.periodKey,
        anchorAt: anchor.anchorAt,
        anchorDate: anchor.date,
        nominalDate: anchor.nominalDate,
        shifted: anchor.shifted,
      });
    }
  }
  return projected.sort((a, b) => a.anchorAt.localeCompare(b.anchorAt));
}
