/**
 * Working days (§6.1, §6.2, §6.2a). This module answers date questions only:
 *
 * - Is a local date a working day?
 * - Which date is n working days before or after a date?
 * - Which date does a schedule rule give for a period?
 *
 * A working day is a Europe/Vienna calendar date that falls on a weekday in `workingWeek`, is not a
 * statutory public holiday and is not a company closure. Times of day and working hours never affect a
 * working-day count, so this module must not import `working-hours` (§6.1a).
 *
 * The counting conventions of §6.2a are binding:
 * - Task offsets: the anchor date is position 0 and is never counted. −1 WD is the previous working day,
 *   +2 WD the second working day after it, 0 WD the anchor date itself (even when it is not a working day).
 * - `nthWorkingDay(n)`: the first working day of the month is number 1.
 * - `workingDaysBeforeMonthEnd(n)`: the last working day L is position 0 and is not counted; the result has
 *   exactly n working days of the same month after it.
 *
 * Pure: the calendar is passed in, nothing reads the clock.
 */
import type { ISODate, ScheduleRule, WeekendShift, WorkCalendar } from "../domain/types";
import { addCalendarDays, clampedDate, compareIsoDates, daysInMonth, formatIsoDateParts, isoWeekday, monthEnd, monthStart } from "./dates";
import { addPeriods, periodStart, type Period } from "./periods";

export {
  addPeriods,
  parsePeriodKey,
  periodEnd,
  periodKey,
  periodOfDate,
  periodOrdinal,
  periodStart,
  type Period,
} from "./periods";

/** The parts of the work calendar that decide whether a date is a working day. Working hours are not one of them. */
export type WorkingDayCalendar = Pick<WorkCalendar, "workingWeek" | "publicHolidays" | "companyClosures">;

export type NonWorkingReason = "weekend" | "public-holiday" | "company-closure";

/**
 * Upper bound for any search for a working day. A calendar without a single working day in this many
 * days (an empty working week) is a configuration error and is reported instead of looping forever.
 */
const SEARCH_LIMIT_DAYS = 400;

export class NoWorkingDayError extends RangeError {
  constructor(from: ISODate) {
    super(`No working day within ${SEARCH_LIMIT_DAYS} days of ${from}`);
    this.name = "NoWorkingDayError";
  }
}

/** Why a date is not a working day, or null when it is one. A holiday on a weekend reports `public-holiday`. */
export function nonWorkingReason(calendar: WorkingDayCalendar, date: ISODate): NonWorkingReason | null {
  if (calendar.publicHolidays.some((holiday) => holiday.date === date)) return "public-holiday";
  if (calendar.companyClosures.some((closure) => closure.date === date)) return "company-closure";
  if (!calendar.workingWeek.includes(isoWeekday(date))) return "weekend";
  return null;
}

export function isWorkingDay(calendar: WorkingDayCalendar, date: ISODate): boolean {
  return nonWorkingReason(calendar, date) === null;
}

function step(calendar: WorkingDayCalendar, date: ISODate, direction: 1 | -1): ISODate {
  let current = date;
  for (let i = 0; i < SEARCH_LIMIT_DAYS; i += 1) {
    current = addCalendarDays(current, direction);
    if (isWorkingDay(calendar, current)) return current;
  }
  throw new NoWorkingDayError(date);
}

/** The first working day strictly after `date`. */
export function nextWorkingDay(calendar: WorkingDayCalendar, date: ISODate): ISODate {
  return step(calendar, date, 1);
}

/** The last working day strictly before `date`. */
export function previousWorkingDay(calendar: WorkingDayCalendar, date: ISODate): ISODate {
  return step(calendar, date, -1);
}

/**
 * The date `n` working days after (n > 0) or before (n < 0) `date` (§6.2a). `date` is position 0 and is
 * not counted, whether or not it is a working day; `n = 0` returns `date` itself.
 */
export function addWorkingDays(calendar: WorkingDayCalendar, date: ISODate, n: number): ISODate {
  if (!Number.isInteger(n)) throw new RangeError(`Working-day offsets are whole numbers: ${n}`);
  let current = date;
  for (let i = 0; i < Math.abs(n); i += 1) current = step(calendar, current, n > 0 ? 1 : -1);
  return current;
}

/**
 * Working days from `from` to `to`, counted with the §6.2a convention: `from` is position 0, and each
 * working day after it up to and including `to` counts one. Negative when `to` is before `from`.
 * "Within 2 working days of the anchor" means `workingDaysBetween(today, anchorDate) <= 2`.
 */
export function workingDaysBetween(calendar: WorkingDayCalendar, from: ISODate, to: ISODate): number {
  const order = compareIsoDates(from, to);
  if (order === 0) return 0;
  const [start, end, sign] = order < 0 ? [from, to, 1] : [to, from, -1];
  let count = 0;
  for (let current = addCalendarDays(start, 1); compareIsoDates(current, end) <= 0; current = addCalendarDays(current, 1)) {
    if (isWorkingDay(calendar, current)) count += 1;
  }
  return count * sign;
}

/** All working days of a month, in order. */
export function workingDaysInMonth(calendar: WorkingDayCalendar, year: number, month: number): ISODate[] {
  const days: ISODate[] = [];
  for (let day = 1; day <= daysInMonth(year, month); day += 1) {
    const date = formatIsoDateParts(year, month, day);
    if (isWorkingDay(calendar, date)) days.push(date);
  }
  return days;
}

/** The n-th working day of a month (first = 1), or null when the month has fewer than n working days. */
export function nthWorkingDayOfMonth(calendar: WorkingDayCalendar, year: number, month: number, n: number): ISODate | null {
  if (!Number.isInteger(n) || n < 1) return null;
  return workingDaysInMonth(calendar, year, month)[n - 1] ?? null;
}

/** The last working day of a month, or null when it has none. */
export function lastWorkingDayOfMonth(calendar: WorkingDayCalendar, year: number, month: number): ISODate | null {
  const days = workingDaysInMonth(calendar, year, month);
  return days[days.length - 1] ?? null;
}

/**
 * The working day with exactly `n` working days of the same month after it: the last working day L is
 * position 0, and the result is n working days before L. Null when the month has n or fewer working days.
 */
export function workingDaysBeforeMonthEnd(calendar: WorkingDayCalendar, year: number, month: number, n: number): ISODate | null {
  if (!Number.isInteger(n) || n < 0) return null;
  const days = workingDaysInMonth(calendar, year, month);
  return days[days.length - 1 - n] ?? null;
}

/** For date-based rules: moves a non-working date to the previous or next working day, or leaves it (§6.2 step 2). */
export function applyWeekendShift(calendar: WorkingDayCalendar, date: ISODate, shift: WeekendShift): ISODate {
  if (shift === "none" || isWorkingDay(calendar, date)) return date;
  return shift === "previous-working-day" ? previousWorkingDay(calendar, date) : nextWorkingDay(calendar, date);
}

export type RuleDateIssue =
  /** `nthWorkingDay(n)` with n larger than the number of working days in the month: not generated (§6.2). */
  | "nth-working-day-out-of-range"
  /** `workingDaysBeforeMonthEnd(n)` with n not smaller than the number of working days in the month. */
  | "working-days-before-month-end-out-of-range"
  /** The rule cannot be used with this frequency, e.g. `weekday` on a monthly schedule. */
  | "rule-frequency-mismatch"
  /** The calendar has no working day near the date (for example an empty working week). */
  | "no-working-day";

export type RuleDateResult =
  | { ok: true; date: ISODate; nominalDate: ISODate; shifted: boolean }
  | { ok: false; issue: RuleDateIssue };

/** Which rules a frequency accepts (§4.2 comments on `ScheduleRule`). */
export const RULES_BY_FREQUENCY: Record<Period["frequency"], readonly ScheduleRule["kind"][]> = {
  weekly: ["weekday"],
  monthly: ["dayOfMonth", "nthWorkingDay", "workingDaysBeforeMonthEnd"],
  quarterly: ["monthAndDay"],
  annually: ["monthAndDay"],
};

/**
 * The local date a schedule rule gives in the period in which the anchor falls (§6.2 steps 1 and 2).
 * `anchorPeriod` is already shifted by `anchorPeriodOffset`; the period key is decided by the caller.
 */
export function ruleDate(calendar: WorkingDayCalendar, rule: ScheduleRule, anchorPeriod: Period, weekendShift: WeekendShift): RuleDateResult {
  if (!RULES_BY_FREQUENCY[anchorPeriod.frequency].includes(rule.kind)) return { ok: false, issue: "rule-frequency-mismatch" };
  try {
    const start = periodStart(anchorPeriod);
    const [year, month] = [Number(start.slice(0, 4)), Number(start.slice(5, 7))];
    const dateBased = (nominalDate: ISODate): RuleDateResult => {
      const date = applyWeekendShift(calendar, nominalDate, weekendShift);
      return { ok: true, date, nominalDate, shifted: date !== nominalDate };
    };
    switch (rule.kind) {
      case "dayOfMonth":
        return dateBased(clampedDate(year, month, rule.day));
      case "monthAndDay":
        // Quarterly: month within the quarter (1–3). Annually: month of the year (1–12).
        return dateBased(clampedDate(year, month + rule.month - 1, rule.day));
      case "weekday":
        return dateBased(addCalendarDays(start, rule.weekday - 1));
      case "nthWorkingDay": {
        const date = nthWorkingDayOfMonth(calendar, year, month, rule.n);
        return date ? { ok: true, date, nominalDate: date, shifted: false } : { ok: false, issue: "nth-working-day-out-of-range" };
      }
      case "workingDaysBeforeMonthEnd": {
        const date = workingDaysBeforeMonthEnd(calendar, year, month, rule.n);
        return date ? { ok: true, date, nominalDate: date, shifted: false } : { ok: false, issue: "working-days-before-month-end-out-of-range" };
      }
    }
  } catch (error) {
    if (error instanceof NoWorkingDayError) return { ok: false, issue: "no-working-day" };
    throw error;
  }
}

/** The covered period's anchor period: the same period, or the next one with `anchorPeriodOffset: 1`. */
export function anchorPeriodFor(covered: Period, anchorPeriodOffset: 0 | 1): Period {
  return addPeriods(covered, anchorPeriodOffset);
}

/** Convenience for tests and previews: first and last calendar date of a month. */
export function monthBounds(year: number, month: number): { start: ISODate; end: ISODate } {
  return { start: monthStart(year, month), end: monthEnd(year, month) };
}
