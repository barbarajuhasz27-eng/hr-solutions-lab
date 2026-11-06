/**
 * Working hours (§6.1a) and the reference results T18–T21 (§6.2b), in their own test file as the spec asks.
 */
import { describe, expect, it } from "vitest";
import { localDateOf, localTimeOf, zonedToUtc } from "../lib/calendar/dates";
import { workingIntervals, workingMinutesBetween, workingMinutesPerWeekday, workingMinutesUntil, type WorkingHoursCalendar } from "../lib/calendar/working-hours";
import { parsePeriodKey } from "../lib/calendar/periods";
import { applyAction } from "../lib/domain/reducer";
import { CURRENT_USER_ID } from "../lib/domain/seed";
import type { WorkCalendar } from "../lib/domain/types";
import { resolveDueAt } from "../lib/schedule/offsets";
import { resolvePeriodAnchor } from "../lib/schedule/rules";
import { calendarWithClosures, monthlySchedule, recurringOperation, storeWith } from "./fixtures/schedule";

const at = (date: string, time: string) => zonedToUtc(date, time);
const DEMO = calendarWithClosures([]);
const hours = (calendar: WorkCalendar, intervals: [string, string][]): WorkingHoursCalendar => {
  const day = intervals.map(([start, end]) => ({ start, end }));
  return { ...calendar, workingHours: { 1: day, 2: day, 3: day, 4: day, 5: day } };
};

describe("§6.2b reference results T18–T21", () => {
  const from = at("2026-12-18", "16:00"); // Friday
  const to = at("2026-12-21", "12:00"); // Monday

  it("T18: Fri 18.12. 16:00 → Mon 21.12. 12:00, 08–12 and 13–17 → 60 + 240 = 300", () => {
    expect(workingMinutesBetween(DEMO, from, to)).toBe(300);
  });

  /*
   * T19 in §6.2b is not consistent with itself: it configures 07:00–12:00 and 13:00–15:30 but explains the
   * result as "Monday contributes 08:00–12:00", 0 + 240 = 240. With a 07:00 start, Monday 00:00–12:00
   * overlaps 07:00–12:00, which is 300 minutes. Both readings are tested; the spec row needs a decision.
   */
  it("T19 as configured in the spec row (07:00–12:00, 13:00–15:30): Friday 16:00 is outside hours → 0 + 300 = 300", () => {
    expect(workingMinutesBetween(hours(DEMO, [["07:00", "12:00"], ["13:00", "15:30"]]), from, to)).toBe(300);
  });

  it("T19 as reasoned in the spec row (Monday 08:00–12:00, afternoon ends 15:30): 0 + 240 = 240", () => {
    expect(workingMinutesBetween(hours(DEMO, [["08:00", "12:00"], ["13:00", "15:30"]]), from, to)).toBe(240);
  });

  it("T20: Wed 23.12. 09:00 → Mon 28.12. 12:00, closure 24.12. and holiday 25.12. → 420 + 240 = 660", () => {
    const calendar = calendarWithClosures(["2026-12-24"]);
    expect(workingMinutesBetween(calendar, at("2026-12-23", "09:00"), at("2026-12-28", "12:00"))).toBe(660);
  });

  describe("T21: no change to working hours moves an anchor or due date of T1–T17", () => {
    const variants: [string, [string, string][]][] = [
      ["demo default", [["08:00", "12:00"], ["13:00", "17:00"]]],
      ["T19 hours", [["07:00", "12:00"], ["13:00", "15:30"]]],
      ["mornings only", [["06:00", "09:00"]]],
      ["one long interval", [["00:00", "23:59"]]],
    ];
    const D2 = calendarWithClosures(["2026-12-24", "2026-12-31"]);
    const D3 = calendarWithClosures(["2026-12-24"]);
    const D4 = calendarWithClosures(["2026-12-31"]);

    function referenceDates(transform: (calendar: WorkCalendar) => WorkCalendar): string[] {
      const anchor = (schedule: ReturnType<typeof monthlySchedule>, key: string, calendar: WorkCalendar) => {
        const result = resolvePeriodAnchor(schedule, parsePeriodKey(key, "monthly")!, transform(calendar));
        return result.ok ? result.anchorAt : result.issue;
      };
      const cutoff = monthlySchedule();
      const report = monthlySchedule({ rule: { kind: "nthWorkingDay", n: 3 }, anchorPeriodOffset: 1, time: "10:00" });
      const due = (anchorDate: string, amount: number, calendar: WorkCalendar) =>
        resolveDueAt(at(anchorDate, "12:00"), { offset: { amount, unit: "workingDays" } }, transform(calendar));
      return [
        anchor(cutoff, "2026-11", DEMO), anchor(cutoff, "2026-12", DEMO), anchor(cutoff, "2026-12", D2), anchor(cutoff, "2026-12", D3),
        anchor(cutoff, "2026-12", D4), anchor(report, "2026-10", DEMO), anchor(report, "2026-12", DEMO), anchor(report, "2026-12", D4),
        anchor(monthlySchedule({ rule: { kind: "dayOfMonth", day: 31 }, weekendShift: "next-working-day" }), "2026-11", DEMO),
        anchor(monthlySchedule({ rule: { kind: "dayOfMonth", day: 15 }, weekendShift: "previous-working-day" }), "2026-08", DEMO),
        due("2026-11-23", -6, DEMO), due("2026-11-23", 0, DEMO), due("2026-12-21", -2, D2), due("2026-12-21", 2, D2),
        due("2026-12-21", 4, D2), due("2026-12-23", 2, DEMO), due("2026-12-23", 4, DEMO),
      ];
    }

    const baseline = referenceDates((calendar) => calendar);

    it.each(variants)("%s", (_label, intervals) => {
      expect(referenceDates((calendar) => hours(calendar, intervals) as WorkCalendar)).toEqual(baseline);
      expect(referenceDates((calendar) => ({ ...calendar, workingHours: {} }))).toEqual(baseline);
      expect(baseline.map((value) => `${localDateOf(value)} ${localTimeOf(value)}`).slice(0, 3)).toEqual(["2026-11-23 12:00", "2026-12-23 12:00", "2026-12-21 12:00"]);
    });

    it("through the reducer: a working-hours change keeps every stored anchor and due date", () => {
      const NOW = "2026-11-06T09:00:00.000Z";
      let store = storeWith(NOW, [recurringOperation("op-cutoff", monthlySchedule())]);
      store = applyAction(store, { type: "advanceSchedule" }, { now: NOW, actorId: CURRENT_USER_ID });
      const before = store.occurrences;
      const changed = applyAction(store, { type: "updateCalendar", change: { workingHours: { 1: [{ start: "06:00", end: "09:00" }] } } }, { now: NOW, actorId: CURRENT_USER_ID });
      expect(changed.calendar.workingHours).toEqual({ 1: [{ start: "06:00", end: "09:00" }] });
      expect(changed.occurrences).toBe(before);
    });
  });
});

describe("working-minute calculation", () => {
  it("treats the lunch break as non-working time", () => {
    expect(workingMinutesBetween(DEMO, at("2026-11-23", "11:30"), at("2026-11-23", "13:30"))).toBe(60);
    expect(workingMinutesBetween(DEMO, at("2026-11-23", "12:00"), at("2026-11-23", "13:00"))).toBe(0);
    expect(workingMinutesBetween(DEMO, at("2026-11-23", "00:00"), at("2026-11-24", "00:00"))).toBe(480);
  });

  it("uses configured intervals rather than a fixed eight-hour day", () => {
    const short = hours(DEMO, [["09:00", "12:30"]]);
    expect(workingMinutesBetween(short, at("2026-11-23", "00:00"), at("2026-11-24", "00:00"))).toBe(210);
    expect(workingMinutesPerWeekday(DEMO, 1)).toBe(480);
    expect(workingMinutesPerWeekday(short, 1)).toBe(210);
    expect(workingMinutesPerWeekday(DEMO, 6)).toBe(0);
  });

  it("a working weekday without hours contributes zero working minutes", () => {
    const noMonday: WorkingHoursCalendar = { ...DEMO, workingHours: { ...DEMO.workingHours, 1: [] } };
    expect(workingMinutesBetween(noMonday, at("2026-11-23", "00:00"), at("2026-11-24", "00:00"))).toBe(0);
  });

  it("returns zero for reversed or empty ranges, and for weekends and holidays", () => {
    expect(workingMinutesBetween(DEMO, at("2026-11-24", "10:00"), at("2026-11-23", "10:00"))).toBe(0);
    expect(workingMinutesBetween(DEMO, at("2026-11-21", "00:00"), at("2026-11-23", "00:00"))).toBe(0);
    expect(workingMinutesBetween(DEMO, at("2026-12-08", "00:00"), at("2026-12-09", "00:00"))).toBe(0);
  });

  it("remaining time until a cut-off is 0 after it has passed", () => {
    const cutoff = at("2026-11-23", "12:00");
    expect(workingMinutesUntil(DEMO, at("2026-11-20", "16:00"), cutoff)).toBe(60 + 240);
    expect(workingMinutesUntil(DEMO, at("2026-11-23", "13:00"), cutoff)).toBe(0);
  });

  it("lists the overlapping working intervals, clipped to the range", () => {
    expect(workingIntervals(DEMO, at("2026-11-20", "11:00"), at("2026-11-23", "09:00"))).toEqual([
      { start: at("2026-11-20", "11:00"), end: at("2026-11-20", "12:00") },
      { start: at("2026-11-20", "13:00"), end: at("2026-11-20", "17:00") },
      { start: at("2026-11-23", "08:00"), end: at("2026-11-23", "09:00") },
    ]);
  });

  it("counts wall-clock working hours correctly across the DST changes", () => {
    // Friday 27.03. (CET) and Monday 30.03. (CEST) both have 8 working hours.
    expect(workingMinutesBetween(DEMO, at("2026-03-27", "00:00"), at("2026-03-31", "00:00"))).toBe(960);
    expect(workingMinutesBetween(DEMO, at("2026-10-23", "00:00"), at("2026-10-28", "00:00"))).toBe(960); // 26.10. is a holiday
  });
});
