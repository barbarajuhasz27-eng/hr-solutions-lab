/** WorkCalendar seed and configuration (§6.1, §6.1a, Appendix B, Appendix C #2–#4). */
import { describe, expect, it } from "vitest";
import {
  affectsWorkingDays,
  AUSTRIAN_PUBLIC_HOLIDAYS_2026_2027,
  calendarProblems,
  defaultWorkCalendar,
  holidayYearStatus,
  workingDaysWithoutHours,
  yearsBetween,
} from "../lib/calendar/work-calendar";
import { isoWeekday } from "../lib/calendar/dates";
import { createSeedStore } from "../lib/domain/seed";
import type { WorkCalendar } from "../lib/domain/types";

const NOW = "2026-11-06T09:00:00.000Z";
const calendar = defaultWorkCalendar(NOW);

describe("demo defaults (Appendix B)", () => {
  it("Europe/Vienna, Monday–Friday, 08:00–12:00 and 13:00–17:00 with a non-working lunch break", () => {
    expect(calendar.timeZone).toBe("Europe/Vienna");
    expect(calendar.workingWeek).toEqual([1, 2, 3, 4, 5]);
    for (const day of [1, 2, 3, 4, 5] as const) expect(calendar.workingHours[day]).toEqual([{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }]);
    expect(calendar.workingHours[6]).toBeUndefined();
    expect(calendar.workingHours[7]).toBeUndefined();
  });

  it("the 13 statutory holidays of § 7 Abs. 2 ARG per year, each with its source and verified: false", () => {
    for (const year of ["2026", "2027"]) expect(calendar.publicHolidays.filter((holiday) => holiday.date.startsWith(year))).toHaveLength(13);
    expect(calendar.publicHolidays.every((holiday) => holiday.source === "ARG § 7 Abs. 2" && holiday.verified === false)).toBe(true);
    // The table in §6.1, including weekdays.
    const table: [string, string, number][] = [
      ["2026-01-01", "Neujahr", 4], ["2026-01-06", "Heilige Drei Könige", 2], ["2026-04-06", "Ostermontag", 1],
      ["2026-05-01", "Staatsfeiertag", 5], ["2026-05-14", "Christi Himmelfahrt", 4], ["2026-05-25", "Pfingstmontag", 1],
      ["2026-06-04", "Fronleichnam", 4], ["2026-08-15", "Mariä Himmelfahrt", 6], ["2026-10-26", "Nationalfeiertag", 1],
      ["2026-11-01", "Allerheiligen", 7], ["2026-12-08", "Mariä Empfängnis", 2], ["2026-12-25", "Christtag", 5], ["2026-12-26", "Stefanitag", 6],
      ["2027-01-01", "Neujahr", 5], ["2027-01-06", "Heilige Drei Könige", 3], ["2027-03-29", "Ostermontag", 1],
      ["2027-05-01", "Staatsfeiertag", 6], ["2027-05-06", "Christi Himmelfahrt", 4], ["2027-05-17", "Pfingstmontag", 1],
      ["2027-05-27", "Fronleichnam", 4], ["2027-08-15", "Mariä Himmelfahrt", 7], ["2027-10-26", "Nationalfeiertag", 2],
      ["2027-11-01", "Allerheiligen", 1], ["2027-12-08", "Mariä Empfängnis", 3], ["2027-12-25", "Christtag", 6], ["2027-12-26", "Stefanitag", 7],
    ];
    expect(calendar.publicHolidays.map((holiday) => [holiday.date, holiday.name, isoWeekday(holiday.date)])).toEqual(table);
    expect(AUSTRIAN_PUBLIC_HOLIDAYS_2026_2027).toHaveLength(26);
  });

  it("24.12. and 31.12. are company closures, never statutory public holidays", () => {
    const holidayDates = calendar.publicHolidays.map((holiday) => holiday.date);
    for (const date of ["2026-12-24", "2026-12-31", "2027-12-24", "2027-12-31"]) expect(holidayDates).not.toContain(date);
    expect(calendar.companyClosures).toEqual([
      { date: "2026-12-24", name: "Demo company closure" },
      { date: "2026-12-31", name: "Demo company closure" },
    ]);
    // Good Friday is not a general holiday any more.
    expect(holidayDates).not.toContain("2026-04-03");
  });

  it("is the calendar of the synthetic seed and passes validation", () => {
    expect(createSeedStore(NOW).calendar).toEqual(calendar);
    expect(calendarProblems(calendar)).toEqual([]);
    expect(workingDaysWithoutHours(calendar)).toEqual([]);
  });
});

describe("holiday verification status (§6.1)", () => {
  it("reports unverified years and missing years", () => {
    expect(holidayYearStatus(calendar, yearsBetween("2026-11-06", "2028-02-01"))).toEqual([
      { year: 2026, entries: 13, unverified: true, missing: false },
      { year: 2027, entries: 13, unverified: true, missing: false },
      { year: 2028, entries: 0, unverified: false, missing: true },
    ]);
  });

  it("a year counts as verified only when every entry is", () => {
    const partly: WorkCalendar = { ...calendar, publicHolidays: calendar.publicHolidays.map((holiday) => ({ ...holiday, verified: holiday.date !== "2027-12-26" })) };
    expect(holidayYearStatus(partly, [2026, 2027]).map((status) => status.unverified)).toEqual([false, true]);
  });
});

describe("configuration checks", () => {
  it.each<[string, Partial<WorkCalendar>, string]>([
    ["empty working week", { workingWeek: [] }, "working-week-empty"],
    ["weekday 8", { workingWeek: [1, 8 as never] }, "working-week-invalid"],
    ["duplicate weekday", { workingWeek: [1, 1] }, "working-week-invalid"],
    ["reversed interval", { workingHours: { 1: [{ start: "12:00", end: "08:00" }] } }, "working-hours-invalid"],
    ["bad time", { workingHours: { 1: [{ start: "8:00", end: "12:00" }] } }, "working-hours-invalid"],
    ["overlap", { workingHours: { 1: [{ start: "08:00", end: "12:30" }, { start: "12:00", end: "17:00" }] } }, "working-hours-overlap"],
    ["unordered", { workingHours: { 1: [{ start: "13:00", end: "17:00" }, { start: "08:00", end: "12:00" }] } }, "working-hours-overlap"],
    ["duplicate holiday", { publicHolidays: [calendar.publicHolidays[0], calendar.publicHolidays[0]] }, "holiday-duplicate"],
    ["invalid closure", { companyClosures: [{ date: "2026-13-01", name: "X" }] }, "closure-invalid"],
  ])("flags %s", (_label, change, problem) => {
    expect(calendarProblems({ ...calendar, ...change })).toContain(problem);
  });

  it("flags working days without hours (they contribute zero working minutes)", () => {
    expect(workingDaysWithoutHours({ ...calendar, workingWeek: [1, 2, 3, 4, 5, 6] })).toEqual([6]);
  });

  it("only working week, holidays and closures can move dates; working hours cannot", () => {
    expect(affectsWorkingDays(calendar, { ...calendar, workingHours: {} })).toBe(false);
    expect(affectsWorkingDays(calendar, { ...calendar, companyClosures: [] })).toBe(true);
    expect(affectsWorkingDays(calendar, { ...calendar, workingWeek: [1, 2, 3, 4] })).toBe(true);
    expect(affectsWorkingDays(calendar, { ...calendar, publicHolidays: calendar.publicHolidays.slice(1) })).toBe(true);
    // Verifying a holiday changes no date.
    expect(affectsWorkingDays(calendar, { ...calendar, publicHolidays: calendar.publicHolidays.map((holiday) => ({ ...holiday, verified: true })) })).toBe(false);
  });
});
