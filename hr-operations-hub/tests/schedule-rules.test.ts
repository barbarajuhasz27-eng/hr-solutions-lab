/** Schedule rules (§6.2), period keys (§6.8) and schedule versions (§6.6). Neutral fixtures. */
import { describe, expect, it } from "vitest";
import { localTimeOf } from "../lib/calendar/dates";
import { addPeriods, parsePeriodKey, periodEnd, periodKey, periodOfDate, periodStart, type Period } from "../lib/calendar/periods";
import type { Schedule, ScheduleRule } from "../lib/domain/types";
import { previewAnchors, resolvePeriodAnchor, ruleProblems, scheduleProblems, scheduleVersions } from "../lib/schedule/rules";
import { scheduleWithChange } from "../lib/schedule/changes";
import { DomainError } from "../lib/domain/errors";
import { calendarWithClosures, monthlySchedule } from "./fixtures/schedule";

const CAL = calendarWithClosures(["2026-12-24", "2026-12-31"]); // the demo calendar
const NONE = calendarWithClosures([]);

function schedule(frequency: Schedule["frequency"], rule: ScheduleRule, overrides: Partial<Schedule> = {}): Schedule {
  return monthlySchedule({ frequency, rule, time: "09:00", ...overrides });
}

function anchorOf(s: Schedule, key: string, calendar = CAL) {
  const result = resolvePeriodAnchor(s, parsePeriodKey(key, s.frequency)!, calendar);
  return result.ok ? `${result.date} ${localTimeOf(result.anchorAt)}` : result.issue;
}

describe("period keys (§6.8)", () => {
  it.each<[Schedule["frequency"], string, string]>([
    ["monthly", "2026-11-23", "2026-11"],
    ["weekly", "2026-11-03", "2026-W45"],
    ["weekly", "2026-12-31", "2026-W53"],
    ["weekly", "2027-01-01", "2026-W53"],
    ["weekly", "2027-01-04", "2027-W01"],
    ["weekly", "2025-12-29", "2026-W01"],
    ["quarterly", "2026-11-23", "2026-Q4"],
    ["quarterly", "2027-03-31", "2027-Q1"],
    ["annually", "2026-11-23", "2026"],
  ])("%s period of %s is %s", (frequency, date, key) => {
    expect(periodKey(periodOfDate(frequency, date))).toBe(key);
    expect(parsePeriodKey(key, frequency)).toEqual(periodOfDate(frequency, date));
  });

  it("knows each period's first and last date", () => {
    const span = (p: Period) => [periodStart(p), periodEnd(p)];
    expect(span(parsePeriodKey("2026-02", "monthly")!)).toEqual(["2026-02-01", "2026-02-28"]);
    expect(span(parsePeriodKey("2028-02", "monthly")!)).toEqual(["2028-02-01", "2028-02-29"]);
    expect(span(parsePeriodKey("2026-W53", "weekly")!)).toEqual(["2026-12-28", "2027-01-03"]);
    expect(span(parsePeriodKey("2027-W01", "weekly")!)).toEqual(["2027-01-04", "2027-01-10"]);
    expect(span(parsePeriodKey("2026-Q4", "quarterly")!)).toEqual(["2026-10-01", "2026-12-31"]);
    expect(span(parsePeriodKey("2027", "annually")!)).toEqual(["2027-01-01", "2027-12-31"]);
  });

  it("steps across year ends, including ISO week-years with 53 weeks", () => {
    expect(periodKey(addPeriods(parsePeriodKey("2026-12", "monthly")!, 1))).toBe("2027-01");
    expect(periodKey(addPeriods(parsePeriodKey("2027-01", "monthly")!, -2))).toBe("2026-11");
    expect(periodKey(addPeriods(parsePeriodKey("2026-W52", "weekly")!, 1))).toBe("2026-W53");
    expect(periodKey(addPeriods(parsePeriodKey("2026-W53", "weekly")!, 1))).toBe("2027-W01");
    expect(periodKey(addPeriods(parsePeriodKey("2027-W52", "weekly")!, 1))).toBe("2028-W01"); // 2027 has 52 weeks
    expect(periodKey(addPeriods(parsePeriodKey("2026-Q4", "quarterly")!, 1))).toBe("2027-Q1");
    expect(periodKey(addPeriods(parsePeriodKey("2026", "annually")!, 1))).toBe("2027");
  });

  it("rejects malformed keys and weeks that do not exist", () => {
    expect(parsePeriodKey("2026-13", "monthly")).toBeNull();
    expect(parsePeriodKey("2026-11", "weekly")).toBeNull();
    expect(parsePeriodKey("2027-W53", "weekly")).toBeNull();
    expect(parsePeriodKey("2026-Q5", "quarterly")).toBeNull();
    expect(parsePeriodKey("once", "annually")).toBeNull();
  });
});

describe("the five rules (§6.2)", () => {
  it("dayOfMonth clamps to the month length and shifts only when asked", () => {
    expect(anchorOf(schedule("monthly", { kind: "dayOfMonth", day: 31 }), "2026-11")).toBe("2026-11-30 09:00");
    expect(anchorOf(schedule("monthly", { kind: "dayOfMonth", day: 31 }), "2027-02")).toBe("2027-02-28 09:00"); // Sunday, no shift
    expect(anchorOf(schedule("monthly", { kind: "dayOfMonth", day: 31 }, { weekendShift: "previous-working-day" }), "2027-02")).toBe("2027-02-26 09:00");
    expect(anchorOf(schedule("monthly", { kind: "dayOfMonth", day: 30 }, { weekendShift: "next-working-day" }), "2027-02")).toBe("2027-03-01 09:00");
    expect(anchorOf(schedule("monthly", { kind: "dayOfMonth", day: 8 }, { weekendShift: "next-working-day" }), "2026-12")).toBe("2026-12-09 09:00"); // 08.12. holiday
    expect(anchorOf(schedule("monthly", { kind: "dayOfMonth", day: 24 }, { weekendShift: "previous-working-day" }), "2026-12")).toBe("2026-12-23 09:00"); // closure
  });

  it("nthWorkingDay counts the first working day as 1 and flags impossible values", () => {
    expect(anchorOf(schedule("monthly", { kind: "nthWorkingDay", n: 1 }), "2027-01")).toBe("2027-01-04 09:00");
    expect(anchorOf(schedule("monthly", { kind: "nthWorkingDay", n: 19 }), "2026-12")).toBe("2026-12-30 09:00");
    expect(anchorOf(schedule("monthly", { kind: "nthWorkingDay", n: 20 }), "2026-12")).toBe("nth-working-day-out-of-range");
    expect(anchorOf(schedule("monthly", { kind: "nthWorkingDay", n: 21 }), "2026-12", NONE)).toBe("2026-12-31 09:00"); // without closures: 21 working days
  });

  it("workingDaysBeforeMonthEnd has L at position 0", () => {
    expect(anchorOf(schedule("monthly", { kind: "workingDaysBeforeMonthEnd", n: 0 }), "2026-12")).toBe("2026-12-30 09:00");
    expect(anchorOf(schedule("monthly", { kind: "workingDaysBeforeMonthEnd", n: 0 }), "2026-12", NONE)).toBe("2026-12-31 09:00");
    expect(anchorOf(schedule("monthly", { kind: "workingDaysBeforeMonthEnd", n: 5 }), "2027-01")).toBe("2027-01-22 09:00");
    expect(anchorOf(schedule("monthly", { kind: "workingDaysBeforeMonthEnd", n: 19 }), "2026-12")).toBe("working-days-before-month-end-out-of-range");
  });

  it("weekday is the ISO weekday of the week, with weekend shift", () => {
    expect(anchorOf(schedule("weekly", { kind: "weekday", weekday: 1 }), "2026-W45")).toBe("2026-11-02 09:00");
    expect(anchorOf(schedule("weekly", { kind: "weekday", weekday: 5 }), "2026-W53")).toBe("2027-01-01 09:00"); // holiday, no shift
    expect(anchorOf(schedule("weekly", { kind: "weekday", weekday: 5 }, { weekendShift: "previous-working-day" }), "2026-W53")).toBe("2026-12-30 09:00");
    expect(anchorOf(schedule("weekly", { kind: "weekday", weekday: 6 }, { weekendShift: "next-working-day" }), "2026-W45")).toBe("2026-11-09 09:00");
  });

  it("monthAndDay uses the month within the quarter or the year, clamped", () => {
    expect(anchorOf(schedule("quarterly", { kind: "monthAndDay", month: 1, day: 15 }), "2026-Q4")).toBe("2026-10-15 09:00");
    expect(anchorOf(schedule("quarterly", { kind: "monthAndDay", month: 3, day: 31 }), "2026-Q4")).toBe("2026-12-31 09:00"); // closure, no shift
    expect(anchorOf(schedule("quarterly", { kind: "monthAndDay", month: 3, day: 31 }, { weekendShift: "previous-working-day" }), "2026-Q4")).toBe("2026-12-30 09:00");
    expect(anchorOf(schedule("quarterly", { kind: "monthAndDay", month: 2, day: 31 }), "2027-Q1")).toBe("2027-02-28 09:00");
    expect(anchorOf(schedule("annually", { kind: "monthAndDay", month: 2, day: 29 }), "2027")).toBe("2027-02-28 09:00");
    expect(anchorOf(schedule("annually", { kind: "monthAndDay", month: 2, day: 29 }), "2028")).toBe("2028-02-29 09:00");
    expect(anchorOf(schedule("annually", { kind: "monthAndDay", month: 12, day: 25 }, { weekendShift: "next-working-day" }), "2026")).toBe("2026-12-28 09:00");
  });

  it("anchorPeriodOffset moves the anchor into the next period but keeps the covered period key", () => {
    const s = schedule("quarterly", { kind: "monthAndDay", month: 1, day: 10 }, { anchorPeriodOffset: 1 });
    const result = resolvePeriodAnchor(s, parsePeriodKey("2026-Q4", "quarterly")!, CAL);
    expect(result).toMatchObject({ ok: true, periodKey: "2026-Q4", date: "2027-01-10" });
    const weekly = resolvePeriodAnchor(schedule("weekly", { kind: "weekday", weekday: 1 }, { anchorPeriodOffset: 1 }), parsePeriodKey("2026-W53", "weekly")!, CAL);
    expect(weekly).toMatchObject({ ok: true, periodKey: "2026-W53", date: "2027-01-04" });
  });

  it("a weekend shift across the period boundary keeps the period key", () => {
    // 01.11.2026 is a Sunday and a holiday; shifted back into October.
    const result = resolvePeriodAnchor(schedule("monthly", { kind: "dayOfMonth", day: 1 }, { weekendShift: "previous-working-day" }), parsePeriodKey("2026-11", "monthly")!, CAL);
    expect(result).toMatchObject({ ok: true, periodKey: "2026-11", date: "2026-10-30", nominalDate: "2026-11-01", shifted: true });
  });

  it("applies the schedule time in Europe/Vienna, in winter and summer", () => {
    const s = schedule("monthly", { kind: "dayOfMonth", day: 15 }, { time: "12:00" });
    expect(resolvePeriodAnchor(s, parsePeriodKey("2026-07", "monthly")!, CAL)).toMatchObject({ anchorAt: "2026-07-15T10:00:00.000Z" });
    expect(resolvePeriodAnchor(s, parsePeriodKey("2026-01", "monthly")!, CAL)).toMatchObject({ anchorAt: "2026-01-15T11:00:00.000Z" });
  });
});

describe("interval, start and end (§6.4)", () => {
  it("interval counts periods from the period of startDate", () => {
    const s = monthlySchedule({ interval: 2, startDate: "2026-09-10" });
    expect(anchorOf(s, "2026-09")).toBe("2026-09-23 12:00");
    expect(anchorOf(s, "2026-10")).toBe("interval-skip");
    expect(anchorOf(s, "2026-11")).toBe("2026-11-23 12:00");
    expect(anchorOf(s, "2026-08")).toBe("before-start");
  });

  it("no anchor before startDate or after endDate", () => {
    const s = monthlySchedule({ startDate: "2026-11-24", endDate: "2027-01-21" });
    expect(anchorOf(s, "2026-11")).toBe("before-start"); // 23.11. is before the start
    expect(anchorOf(s, "2026-12")).toBe("2026-12-21 12:00");
    expect(anchorOf(s, "2027-01")).toBe("after-end"); // 22.01.2027
  });
});

describe("validation", () => {
  it("accepts each frequency only with its rules", () => {
    expect(ruleProblems({ kind: "weekday", weekday: 1 }, "weekly")).toEqual([]);
    expect(ruleProblems({ kind: "dayOfMonth", day: 1 }, "weekly")).toEqual(["rule-frequency-mismatch"]);
    for (const kind of ["dayOfMonth", "nthWorkingDay", "workingDaysBeforeMonthEnd"] as const) {
      const r = (kind === "dayOfMonth" ? { kind, day: 5 } : { kind, n: 2 }) as ScheduleRule;
      expect(ruleProblems(r, "monthly")).toEqual([]);
      expect(ruleProblems(r, "quarterly")).toEqual(["rule-frequency-mismatch"]);
    }
    expect(ruleProblems({ kind: "monthAndDay", month: 3, day: 1 }, "quarterly")).toEqual([]);
    expect(ruleProblems({ kind: "monthAndDay", month: 4, day: 1 }, "quarterly")).toEqual(["rule-invalid"]);
    expect(ruleProblems({ kind: "monthAndDay", month: 12, day: 1 }, "annually")).toEqual([]);
    expect(ruleProblems({ kind: "monthAndDay", month: 1, day: 1 }, "monthly")).toEqual(["rule-frequency-mismatch"]);
    expect(anchorOf(schedule("monthly", { kind: "weekday", weekday: 1 }), "2026-11")).toBe("rule-frequency-mismatch");
  });

  it.each<[string, Partial<Schedule>, string]>([
    ["day 0", { rule: { kind: "dayOfMonth", day: 0 } }, "rule-invalid"],
    ["day 32", { rule: { kind: "dayOfMonth", day: 32 } }, "rule-invalid"],
    ["nth 0", { rule: { kind: "nthWorkingDay", n: 0 } }, "rule-invalid"],
    ["nth 24", { rule: { kind: "nthWorkingDay", n: 24 } }, "rule-invalid"],
    ["n −1", { rule: { kind: "workingDaysBeforeMonthEnd", n: -1 } }, "rule-invalid"],
    ["fractional", { rule: { kind: "workingDaysBeforeMonthEnd", n: 2.5 } }, "rule-invalid"],
    ["interval 0", { interval: 0 }, "interval-invalid"],
    ["time 24:00", { time: "24:00" }, "time-invalid"],
    ["end before start", { startDate: "2026-12-01", endDate: "2026-11-01" }, "end-before-start"],
    ["bad start", { startDate: "2026-02-30" }, "start-date-invalid"],
  ])("rejects %s", (_label, overrides, problem) => {
    expect(scheduleProblems(monthlySchedule(overrides))).toContain(problem);
  });

  it("accepts the demo provider schedule", () => {
    expect(scheduleProblems(monthlySchedule())).toEqual([]);
  });
});

describe("schedule versions (§6.6)", () => {
  const base = monthlySchedule({ startDate: "2026-01-01" });
  const changed = scheduleWithChange(base, { rule: { kind: "workingDaysBeforeMonthEnd", n: 3 }, time: "10:00" }, "2026-12-01");

  it("records the old rule from startDate and the new one from effectiveFrom; top-level fields follow the newest", () => {
    expect(scheduleVersions(base)).toHaveLength(1);
    expect(changed.versions.map((version) => [version.effectiveFrom, version.rule, version.time])).toEqual([
      ["2026-01-01", { kind: "workingDaysBeforeMonthEnd", n: 5 }, "12:00"],
      ["2026-12-01", { kind: "workingDaysBeforeMonthEnd", n: 3 }, "10:00"],
    ]);
    expect(changed).toMatchObject({ rule: { kind: "workingDaysBeforeMonthEnd", n: 3 }, time: "10:00" });
    expect(scheduleProblems(changed)).toEqual([]);
  });

  it("periods before effectiveFrom keep the old rule; later ones use the new rule", () => {
    expect(anchorOf(changed, "2026-11")).toBe("2026-11-23 12:00");
    expect(anchorOf(changed, "2026-12")).toBe("2026-12-23 10:00"); // L 30.12., back 3: 29., 28., 23.
    expect(anchorOf(changed, "2027-01")).toBe("2027-01-26 10:00");
  });

  it("a later change on the same effectiveFrom replaces that version; the frequency stays", () => {
    const again = scheduleWithChange(changed, { time: "11:00" }, "2026-12-01");
    expect(again.versions).toHaveLength(2);
    expect(again.versions[1]).toMatchObject({ time: "11:00", rule: { kind: "workingDaysBeforeMonthEnd", n: 3 } });
    expect(() => scheduleWithChange(base, { rule: { kind: "weekday", weekday: 1 } }, "2026-12-01")).toThrow(DomainError);
    expect(() => scheduleWithChange(base, { time: "noon" }, "2026-12-01")).toThrow(DomainError);
    expect(() => scheduleWithChange(base, { time: "10:00" }, "01.12.2026")).toThrow(DomainError);
  });

  it("detects versions that are out of sync with the top-level fields", () => {
    expect(scheduleProblems({ ...changed, time: "15:00" })).toContain("versions-out-of-sync");
    expect(scheduleProblems({ ...changed, versions: [...changed.versions].reverse() })).toContain("versions-invalid");
  });

  it("previews the next three anchors for the editor", () => {
    expect(previewAnchors(changed, "2026-11-06", CAL).map((anchor) => `${anchor.periodKey} ${anchor.date}`)).toEqual([
      "2026-11 2026-11-23", "2026-12 2026-12-23", "2027-01 2027-01-26",
    ]);
    const report = monthlySchedule({ rule: { kind: "nthWorkingDay", n: 3 }, anchorPeriodOffset: 1, time: "10:00" });
    expect(previewAnchors(report, "2026-11-01", CAL).map((anchor) => `${anchor.periodKey} ${anchor.date}`)).toEqual([
      "2026-10 2026-11-04", "2026-11 2026-12-03", "2026-12 2027-01-07",
    ]);
  });
});
