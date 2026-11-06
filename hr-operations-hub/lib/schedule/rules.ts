/**
 * Schedule rules (§6.2) and schedule versions (§6.6).
 *
 * For a covered period (the period the work is for, which gives the `periodKey`):
 * 1. the anchor period is the covered period, or the next one with `anchorPeriodOffset: 1`;
 * 2. the rule gives a local date in the anchor period (`working-days.ruleDate`), with `weekendShift` for
 *    date-based rules;
 * 3. that date and `schedule.time` are converted from Europe/Vienna to a UTC instant.
 *
 * The period key never follows the shifted anchor: the October report delivered on 04.11.2026 stays
 * `2026-10`, and a `previous-working-day` shift from 01.03. into February keeps the March key.
 */
import { compareIsoDates, isIsoDate, isTimeOfDay, zonedToUtc } from "../calendar/dates";
import {
  addPeriods,
  anchorPeriodFor,
  parsePeriodKey,
  periodKey,
  periodOfDate,
  periodOrdinal,
  ruleDate,
  RULES_BY_FREQUENCY,
  type Period,
  type RuleDateIssue,
  type WorkingDayCalendar,
} from "../calendar/working-days";
import type { ISODate, ISODateTime, Schedule, ScheduleRule, ScheduleVersion } from "../domain/types";

export type ScheduleProblem =
  | "frequency-invalid"
  | "interval-invalid"
  | "rule-invalid"
  | "rule-frequency-mismatch"
  | "time-invalid"
  | "weekend-shift-invalid"
  | "anchor-period-offset-invalid"
  | "start-date-invalid"
  | "end-date-invalid"
  | "end-before-start"
  | "versions-invalid"
  | "versions-out-of-sync";

const FREQUENCIES = ["weekly", "monthly", "quarterly", "annually"] as const;
const SHIFTS = ["previous-working-day", "next-working-day", "none"] as const;
const isWholeNumber = (value: unknown, min: number, max: number) => Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

/** Problems of a rule on its own (value ranges). Whether a month has enough working days is checked per period. */
export function ruleProblems(rule: ScheduleRule, frequency: Schedule["frequency"]): ScheduleProblem[] {
  const problems: ScheduleProblem[] = [];
  switch (rule.kind) {
    case "dayOfMonth":
      if (!isWholeNumber(rule.day, 1, 31)) problems.push("rule-invalid");
      break;
    case "nthWorkingDay":
      // No month has more than 23 working days.
      if (!isWholeNumber(rule.n, 1, 23)) problems.push("rule-invalid");
      break;
    case "workingDaysBeforeMonthEnd":
      if (!isWholeNumber(rule.n, 0, 22)) problems.push("rule-invalid");
      break;
    case "weekday":
      if (!isWholeNumber(rule.weekday, 1, 7)) problems.push("rule-invalid");
      break;
    case "monthAndDay":
      if (!isWholeNumber(rule.day, 1, 31) || !isWholeNumber(rule.month, 1, frequency === "quarterly" ? 3 : 12)) problems.push("rule-invalid");
      break;
    default:
      problems.push("rule-invalid");
  }
  if (FREQUENCIES.includes(frequency) && !RULES_BY_FREQUENCY[frequency].includes(rule.kind)) problems.push("rule-frequency-mismatch");
  return problems;
}

function versionProblems(version: Omit<ScheduleVersion, "effectiveFrom">): ScheduleProblem[] {
  const problems: ScheduleProblem[] = [];
  if (!FREQUENCIES.includes(version.frequency)) problems.push("frequency-invalid");
  if (!isWholeNumber(version.interval, 1, 52)) problems.push("interval-invalid");
  if (!version.rule || typeof version.rule !== "object") problems.push("rule-invalid");
  else problems.push(...ruleProblems(version.rule, version.frequency));
  if (!isTimeOfDay(version.time)) problems.push("time-invalid");
  if (!SHIFTS.includes(version.weekendShift)) problems.push("weekend-shift-invalid");
  if (version.anchorPeriodOffset !== 0 && version.anchorPeriodOffset !== 1) problems.push("anchor-period-offset-invalid");
  return problems;
}

const versionFields = (source: Omit<ScheduleVersion, "effectiveFrom">) =>
  JSON.stringify([source.frequency, source.interval, source.rule, source.anchorPeriodOffset, source.time, source.weekendShift]);

/** Configuration errors of a schedule. An empty list means it can be used. */
export function scheduleProblems(schedule: Schedule): ScheduleProblem[] {
  const problems = new Set<ScheduleProblem>(versionProblems(schedule));
  if (!isIsoDate(schedule.startDate)) problems.add("start-date-invalid");
  if (schedule.endDate !== undefined && !isIsoDate(schedule.endDate)) problems.add("end-date-invalid");
  if (isIsoDate(schedule.startDate) && schedule.endDate !== undefined && isIsoDate(schedule.endDate) && schedule.endDate < schedule.startDate) {
    problems.add("end-before-start");
  }
  if (!Array.isArray(schedule.versions)) {
    problems.add("versions-invalid");
    return [...problems];
  }
  const dates = schedule.versions.map((version) => version.effectiveFrom);
  if (
    !dates.every(isIsoDate) ||
    dates.some((date, index) => index > 0 && date <= dates[index - 1]) ||
    schedule.versions.some((version) => versionProblems(version).length > 0 || version.frequency !== schedule.frequency)
  ) {
    problems.add("versions-invalid");
  }
  const newest = schedule.versions[schedule.versions.length - 1];
  if (newest && versionFields(newest) !== versionFields(schedule)) problems.add("versions-out-of-sync");
  return [...problems];
}

/** The schedule's versions in `effectiveFrom` order; a schedule that never changed has one, from `startDate`. */
export function scheduleVersions(schedule: Schedule): ScheduleVersion[] {
  if (schedule.versions.length > 0) return schedule.versions;
  const { frequency, interval, rule, anchorPeriodOffset, time, weekendShift } = schedule;
  return [{ effectiveFrom: schedule.startDate, frequency, interval, rule, anchorPeriodOffset, time, weekendShift }];
}

/** The covered period that contains `startDate`; interval counting starts there. */
function firstCoveredPeriod(schedule: Schedule): Period {
  return periodOfDate(schedule.frequency, schedule.startDate);
}

export type PeriodAnchor =
  | { ok: true; periodKey: string; date: ISODate; anchorAt: ISODateTime; nominalDate: ISODate; shifted: boolean; version: ScheduleVersion }
  | { ok: false; periodKey: string; issue: RuleDateIssue | "interval-skip" | "before-start" | "after-end" };

/** Anchor of one version for a covered period, without start/end/interval checks. */
function versionAnchor(calendar: WorkingDayCalendar, version: ScheduleVersion, covered: Period): PeriodAnchor {
  const key = periodKey(covered);
  const result = ruleDate(calendar, version.rule, anchorPeriodFor(covered, version.anchorPeriodOffset), version.weekendShift);
  if (!result.ok) return { ok: false, periodKey: key, issue: result.issue };
  return {
    ok: true,
    periodKey: key,
    date: result.date,
    anchorAt: zonedToUtc(result.date, version.time),
    nominalDate: result.nominalDate,
    shifted: result.shifted,
    version,
  };
}

/**
 * The anchor of a covered period (§6.2), with schedule versions (§6.6): the newest version whose own anchor
 * for the period is on or after its `effectiveFrom` applies; earlier periods keep the older rule. The
 * period must be on the interval, and the anchor date within `startDate`…`endDate` (§6.4).
 */
export function resolvePeriodAnchor(schedule: Schedule, covered: Period, calendar: WorkingDayCalendar): PeriodAnchor {
  const key = periodKey(covered);
  const versions = scheduleVersions(schedule);
  let chosen: PeriodAnchor | null = null;
  for (let index = versions.length - 1; index >= 0; index -= 1) {
    const candidate = versionAnchor(calendar, versions[index], covered);
    if (index === 0 || (candidate.ok && compareIsoDates(candidate.date, versions[index].effectiveFrom) >= 0)) {
      chosen = candidate;
      break;
    }
    // An invalid month under a newer rule (e.g. too few working days) still belongs to that rule when the
    // period itself starts on or after its effectiveFrom.
    if (!candidate.ok && periodKey(periodOfDate(covered.frequency, versions[index].effectiveFrom)) <= key) {
      chosen = candidate;
      break;
    }
  }
  const anchor = chosen!;
  const version = anchor.ok ? anchor.version : versions[versions.length - 1];
  const offset = periodOrdinal(covered) - periodOrdinal(firstCoveredPeriod(schedule));
  if (offset < 0) return { ok: false, periodKey: key, issue: "before-start" };
  if (offset % version.interval !== 0) return { ok: false, periodKey: key, issue: "interval-skip" };
  if (!anchor.ok) return anchor;
  if (compareIsoDates(anchor.date, schedule.startDate) < 0) return { ok: false, periodKey: key, issue: "before-start" };
  if (schedule.endDate !== undefined && compareIsoDates(anchor.date, schedule.endDate) > 0) return { ok: false, periodKey: key, issue: "after-end" };
  return anchor;
}

/** `resolvePeriodAnchor` for a stored occurrence's period key. */
export function resolvePeriodKeyAnchor(schedule: Schedule, key: string, calendar: WorkingDayCalendar): PeriodAnchor | null {
  const covered = parsePeriodKey(key, schedule.frequency);
  return covered ? resolvePeriodAnchor(schedule, covered, calendar) : null;
}

/** The next `count` valid anchors on or after a local date: the ScheduleEditor preview (§6.6, M6 UI). */
export function previewAnchors(schedule: Schedule, from: ISODate, calendar: WorkingDayCalendar, count = 3): Extract<PeriodAnchor, { ok: true }>[] {
  const result: Extract<PeriodAnchor, { ok: true }>[] = [];
  // Start one period early: with `anchorPeriodOffset: 1` the previous period's anchor falls in this one.
  let covered = addPeriods(periodOfDate(schedule.frequency, from), -1);
  for (let i = 0; i < 400 && result.length < count; i += 1) {
    const anchor = resolvePeriodAnchor(schedule, covered, calendar);
    if (anchor.ok && compareIsoDates(anchor.date, from) >= 0) result.push(anchor);
    if (!anchor.ok && anchor.issue === "after-end") break;
    covered = addPeriods(covered, 1);
  }
  return result;
}
