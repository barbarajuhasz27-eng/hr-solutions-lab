/**
 * Working hours (§6.1a). This module answers time-budget questions only:
 *
 * - How many working minutes lie between two instants?
 * - How much working time is left until a cut-off?
 * - Which working intervals overlap a time range?
 *
 * Working hours are configured per weekday as ordered, non-overlapping local intervals; breaks are the
 * gaps between them (demo default Mon–Fri 08:00–12:00 and 13:00–17:00, lunch 12:00–13:00 is not working
 * time). There is no fixed 8-hour assumption. Whether a date is a working day at all is asked from
 * `working-days`; this module never defines it.
 *
 * Working hours never move an anchor or a due date. They only change budgets and countdowns.
 *
 * Pure: calendar and instants are passed in, nothing reads the clock.
 */
import type { ISODateTime, WorkCalendar } from "../domain/types";
import { addCalendarDays, compareIsoDates, isoWeekday, localDateOf, minutesOfDay, zonedToUtc } from "./dates";
import { isWorkingDay } from "./working-days";

export type WorkingHoursCalendar = Pick<WorkCalendar, "workingWeek" | "workingHours" | "publicHolidays" | "companyClosures">;

export interface Interval {
  start: ISODateTime;
  end: ISODateTime;
}

const MS_PER_MINUTE = 60_000;
/** Longest range evaluated in one call. Budgets are about days and weeks, not years. */
const MAX_RANGE_DAYS = 800;

/** The configured local intervals of a date, or none when it is not a working day. */
function intervalsOfDate(calendar: WorkingHoursCalendar, date: string): Interval[] {
  if (!isWorkingDay(calendar, date)) return [];
  const configured = calendar.workingHours[isoWeekday(date)] ?? [];
  return configured.map((interval) => ({ start: zonedToUtc(date, interval.start), end: zonedToUtc(date, interval.end) }));
}

/** Working intervals that overlap `[from, to)`, clipped to it, in time order. */
export function workingIntervals(calendar: WorkingHoursCalendar, from: ISODateTime, to: ISODateTime): Interval[] {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  if (!(toMs > fromMs)) return [];
  const result: Interval[] = [];
  const lastDate = localDateOf(new Date(toMs));
  let date = localDateOf(new Date(fromMs));
  for (let i = 0; compareIsoDates(date, lastDate) <= 0; i += 1) {
    if (i > MAX_RANGE_DAYS) throw new RangeError(`Working-hour range longer than ${MAX_RANGE_DAYS} days`);
    for (const interval of intervalsOfDate(calendar, date)) {
      const start = Math.max(fromMs, new Date(interval.start).getTime());
      const end = Math.min(toMs, new Date(interval.end).getTime());
      if (end > start) result.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    }
    date = addCalendarDays(date, 1);
  }
  return result;
}

/** Working minutes between two instants; 0 when `to` is not after `from`. */
export function workingMinutesBetween(calendar: WorkingHoursCalendar, from: ISODateTime, to: ISODateTime): number {
  return workingIntervals(calendar, from, to).reduce(
    (total, interval) => total + (new Date(interval.end).getTime() - new Date(interval.start).getTime()) / MS_PER_MINUTE,
    0,
  );
}

/** Working time left from `now` until a cut-off, in minutes; 0 once the cut-off has passed. */
export function workingMinutesUntil(calendar: WorkingHoursCalendar, now: ISODateTime, cutoff: ISODateTime): number {
  return workingMinutesBetween(calendar, now, cutoff);
}

/** Working minutes configured for one weekday (e.g. 480 for 08:00–12:00 and 13:00–17:00). */
export function workingMinutesPerWeekday(calendar: Pick<WorkCalendar, "workingHours">, weekday: keyof WorkCalendar["workingHours"]): number {
  return (calendar.workingHours[weekday] ?? []).reduce((total, interval) => total + minutesOfDay(interval.end) - minutesOfDay(interval.start), 0);
}
