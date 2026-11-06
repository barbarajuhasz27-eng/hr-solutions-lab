/**
 * WorkCalendar configuration (§4.2, §6.1, §6.1a): demo defaults, validation, holiday-verification status
 * and change classification. The Calendar settings screen that edits it is M7.
 *
 * Three separate layers decide which dates are working days: the working week, statutory public holidays
 * and company closures. Working hours are a fourth, independent layer that only affects time budgets.
 */
import type { ISODate, ISODateTime, ISOWeekday, PublicHoliday, WorkCalendar } from "../domain/types";
import { isIsoDate, isTimeOfDay, minutesOfDay, parseIsoDate } from "./dates";

/** Source of the statutory list. The dates are derived by hand from Easter and not yet checked (§6.1). */
export const STATUTORY_HOLIDAY_SOURCE = "ARG § 7 Abs. 2";
export const RIS_SOURCE_URL = "https://www.ris.bka.gv.at/GeltendeFassung.wxe?Abfrage=Bundesnormen&Gesetzesnummer=10008541";
export const DEMO_CLOSURE_NAME = "Demo company closure";

/**
 * The 13 Austrian statutory public holidays of § 7 Abs. 2 ARG for 2026 and 2027 (§6.1). 24.12. and 31.12.
 * are not statutory holidays and are deliberately absent; they are company closures.
 */
export const AUSTRIAN_PUBLIC_HOLIDAYS_2026_2027: readonly (readonly [ISODate, string])[] = [
  ["2026-01-01", "Neujahr"], ["2026-01-06", "Heilige Drei Könige"], ["2026-04-06", "Ostermontag"],
  ["2026-05-01", "Staatsfeiertag"], ["2026-05-14", "Christi Himmelfahrt"], ["2026-05-25", "Pfingstmontag"],
  ["2026-06-04", "Fronleichnam"], ["2026-08-15", "Mariä Himmelfahrt"], ["2026-10-26", "Nationalfeiertag"],
  ["2026-11-01", "Allerheiligen"], ["2026-12-08", "Mariä Empfängnis"], ["2026-12-25", "Christtag"],
  ["2026-12-26", "Stefanitag"],
  ["2027-01-01", "Neujahr"], ["2027-01-06", "Heilige Drei Könige"], ["2027-03-29", "Ostermontag"],
  ["2027-05-01", "Staatsfeiertag"], ["2027-05-06", "Christi Himmelfahrt"], ["2027-05-17", "Pfingstmontag"],
  ["2027-05-27", "Fronleichnam"], ["2027-08-15", "Mariä Himmelfahrt"], ["2027-10-26", "Nationalfeiertag"],
  ["2027-11-01", "Allerheiligen"], ["2027-12-08", "Mariä Empfängnis"], ["2027-12-25", "Christtag"],
  ["2027-12-26", "Stefanitag"],
];

/** Demo company closures (Appendix B, Appendix C #4): individually removable, never statutory holidays. */
export const DEMO_COMPANY_CLOSURES: readonly ISODate[] = ["2026-12-24", "2026-12-31"];

const DEMO_DAY = [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }];

/** The approved demo defaults (Appendix B). Every public holiday starts `verified: false`. */
export function defaultWorkCalendar(now: ISODateTime): WorkCalendar {
  return {
    timeZone: "Europe/Vienna",
    workingWeek: [1, 2, 3, 4, 5],
    workingHours: { 1: [...DEMO_DAY], 2: [...DEMO_DAY], 3: [...DEMO_DAY], 4: [...DEMO_DAY], 5: [...DEMO_DAY] },
    publicHolidays: AUSTRIAN_PUBLIC_HOLIDAYS_2026_2027.map(([date, name]): PublicHoliday => ({
      date,
      name,
      source: STATUTORY_HOLIDAY_SOURCE,
      verified: false,
    })),
    companyClosures: DEMO_COMPANY_CLOSURES.map((date) => ({ date, name: DEMO_CLOSURE_NAME })),
    updatedAt: now,
  };
}

export type CalendarProblem =
  | "working-week-empty"
  | "working-week-invalid"
  | "working-hours-invalid"
  | "working-hours-overlap"
  | "holiday-invalid"
  | "holiday-duplicate"
  | "closure-invalid"
  | "closure-duplicate";

/** Configuration errors. An empty list means the calendar can be used. */
export function calendarProblems(calendar: Omit<WorkCalendar, "updatedAt" | "timeZone">): CalendarProblem[] {
  const problems = new Set<CalendarProblem>();
  const week = calendar.workingWeek;
  if (week.length === 0) problems.add("working-week-empty");
  if (week.some((day) => !Number.isInteger(day) || day < 1 || day > 7) || new Set(week).size !== week.length) problems.add("working-week-invalid");

  for (const [weekday, intervals] of Object.entries(calendar.workingHours)) {
    const day = Number(weekday);
    if (!Number.isInteger(day) || day < 1 || day > 7 || !Array.isArray(intervals)) {
      problems.add("working-hours-invalid");
      continue;
    }
    let previousEnd = -1;
    for (const interval of intervals) {
      if (!isTimeOfDay(interval.start) || !isTimeOfDay(interval.end) || minutesOfDay(interval.end) <= minutesOfDay(interval.start)) {
        problems.add("working-hours-invalid");
        continue;
      }
      // Ordered and non-overlapping; touching intervals (12:00–12:00) are allowed.
      if (minutesOfDay(interval.start) < previousEnd) problems.add("working-hours-overlap");
      previousEnd = minutesOfDay(interval.end);
    }
  }

  const holidayDates = calendar.publicHolidays.map((holiday) => holiday.date);
  if (calendar.publicHolidays.some((holiday) => !isIsoDate(holiday.date) || !holiday.name.trim() || !holiday.source.trim())) problems.add("holiday-invalid");
  if (new Set(holidayDates).size !== holidayDates.length) problems.add("holiday-duplicate");
  const closureDates = calendar.companyClosures.map((closure) => closure.date);
  if (calendar.companyClosures.some((closure) => !isIsoDate(closure.date) || !closure.name.trim())) problems.add("closure-invalid");
  if (new Set(closureDates).size !== closureDates.length) problems.add("closure-duplicate");
  return [...problems];
}

/** Working weekdays without configured hours: they contribute zero working minutes and are flagged (§6.1a). */
export function workingDaysWithoutHours(calendar: Pick<WorkCalendar, "workingWeek" | "workingHours">): ISOWeekday[] {
  return calendar.workingWeek.filter((day) => (calendar.workingHours[day] ?? []).length === 0);
}

export interface HolidayYearStatus {
  year: number;
  /** Number of public-holiday entries in the year. */
  entries: number;
  /** True when at least one entry of the year is unverified. */
  unverified: boolean;
  /** True when the year has no entries at all: the stronger warning of §6.1. */
  missing: boolean;
}

/** Verification status per year, for the Calendar banner and occurrence markers (§6.1). */
export function holidayYearStatus(calendar: Pick<WorkCalendar, "publicHolidays">, years: number[]): HolidayYearStatus[] {
  return [...new Set(years)].sort((a, b) => a - b).map((year) => {
    const entries = calendar.publicHolidays.filter((holiday) => parseIsoDate(holiday.date).year === year);
    return { year, entries: entries.length, unverified: entries.some((holiday) => !holiday.verified), missing: entries.length === 0 };
  });
}

/** Years touched by a date range, inclusive. */
export function yearsBetween(from: ISODate, to: ISODate): number[] {
  const [start, end] = [parseIsoDate(from).year, parseIsoDate(to).year];
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

/** True when a change can move dates: working week, public holidays or company closures (§6.7). Working hours cannot. */
export function affectsWorkingDays(before: WorkCalendar, after: WorkCalendar): boolean {
  const key = (calendar: WorkCalendar) =>
    JSON.stringify([
      [...calendar.workingWeek].sort(),
      calendar.publicHolidays.map((holiday) => holiday.date).sort(),
      calendar.companyClosures.map((closure) => closure.date).sort(),
    ]);
  return key(before) !== key(after);
}
