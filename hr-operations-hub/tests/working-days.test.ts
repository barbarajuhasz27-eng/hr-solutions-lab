/**
 * Working days (§6.1, §6.2a) and the binding reference results T1–T17 (§6.2b). The calendar is the AT
 * public holidays 2026–2027 with a Mon–Fri week, plus the company closures each row names.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { localDateOf, localTimeOf, zonedToUtc } from "../lib/calendar/dates";
import {
  addWorkingDays,
  applyWeekendShift,
  isWorkingDay,
  lastWorkingDayOfMonth,
  nextWorkingDay,
  nonWorkingReason,
  nthWorkingDayOfMonth,
  previousWorkingDay,
  workingDaysBeforeMonthEnd,
  workingDaysBetween,
  workingDaysInMonth,
  type WorkingDayCalendar,
} from "../lib/calendar/working-days";
import { resolveDueAt } from "../lib/schedule/offsets";
import { resolvePeriodAnchor } from "../lib/schedule/rules";
import { parsePeriodKey } from "../lib/calendar/periods";
import type { Schedule, ScheduleRule } from "../lib/domain/types";
import { calendarWithClosures, monthlySchedule } from "./fixtures/schedule";

const NONE = calendarWithClosures([]);
const D2 = calendarWithClosures(["2026-12-24", "2026-12-31"]);
const D3 = calendarWithClosures(["2026-12-24"]);
const D4 = calendarWithClosures(["2026-12-31"]);

/** Anchor of a monthly schedule for a covered period, as "YYYY-MM-DD HH:mm" in Vienna and as a UTC instant. */
function anchor(schedule: Schedule, key: string, calendar: WorkingDayCalendar) {
  const result = resolvePeriodAnchor(schedule, parsePeriodKey(key, schedule.frequency)!, calendar);
  if (!result.ok) throw new Error(`${key}: ${result.issue}`);
  return { local: `${result.date} ${localTimeOf(result.anchorAt)}`, utc: result.anchorAt, periodKey: result.periodKey };
}

const rule = (r: ScheduleRule, overrides: Partial<Schedule> = {}) => monthlySchedule({ rule: r, ...overrides });

describe("§6.2b reference results T1–T10 (anchors)", () => {
  const cutoff = monthlySchedule(); // workingDaysBeforeMonthEnd(5), 12:00

  it("T1: workingDaysBeforeMonthEnd(5), 11/2026, no closures → Mon 23.11.2026 12:00", () => {
    expect(anchor(cutoff, "2026-11", NONE)).toEqual({ local: "2026-11-23 12:00", utc: "2026-11-23T11:00:00.000Z", periodKey: "2026-11" });
  });

  it("T2 (D1): 12/2026, no closures → Wed 23.12.2026 12:00", () => {
    expect(anchor(cutoff, "2026-12", NONE).local).toBe("2026-12-23 12:00");
  });

  it("T3 (D2): 12/2026, closures 24.12. and 31.12. → Mon 21.12.2026 12:00", () => {
    expect(anchor(cutoff, "2026-12", D2)).toMatchObject({ local: "2026-12-21 12:00", utc: "2026-12-21T11:00:00.000Z" });
  });

  it("T4 (D3): 12/2026, closure 24.12. only → Tue 22.12.2026 12:00", () => {
    expect(anchor(cutoff, "2026-12", D3).local).toBe("2026-12-22 12:00");
  });

  it("T5 (D4): 12/2026, closure 31.12. only → Tue 22.12.2026 12:00", () => {
    expect(anchor(cutoff, "2026-12", D4).local).toBe("2026-12-22 12:00");
  });

  it("the December worked example: L and the five counted days for D1–D4 (§6.2a)", () => {
    const counted = (calendar: WorkingDayCalendar) => {
      const last = lastWorkingDayOfMonth(calendar, 2026, 12)!;
      return [last, ...[1, 2, 3, 4, 5].map((n) => addWorkingDays(calendar, last, -n))].map((date) => date.slice(8));
    };
    expect(counted(NONE)).toEqual(["31", "30", "29", "28", "24", "23"]);
    expect(counted(D2)).toEqual(["30", "29", "28", "23", "22", "21"]);
    expect(counted(D3)).toEqual(["31", "30", "29", "28", "23", "22"]);
    expect(counted(D4)).toEqual(["30", "29", "28", "24", "23", "22"]);
  });

  const report = rule({ kind: "nthWorkingDay", n: 3 }, { anchorPeriodOffset: 1, time: "10:00" });

  it("T6: nthWorkingDay(3), anchorPeriodOffset 1, 10:00, period 10/2026 → Wed 04.11.2026 10:00, key stays 2026-10", () => {
    expect(anchor(report, "2026-10", NONE)).toEqual({ local: "2026-11-04 10:00", utc: "2026-11-04T09:00:00.000Z", periodKey: "2026-10" });
  });

  it("T7: same, period 12/2026 → Thu 07.01.2027 10:00 (01.01. and 06.01. are holidays)", () => {
    expect(anchor(report, "2026-12", NONE)).toEqual({ local: "2027-01-07 10:00", utc: "2027-01-07T09:00:00.000Z", periodKey: "2026-12" });
  });

  it("T8: same, closure 31.12. only → Thu 07.01.2027 10:00 (a December closure does not affect January)", () => {
    expect(anchor(report, "2026-12", D4).local).toBe("2027-01-07 10:00");
  });

  it("T9: dayOfMonth(31), next-working-day shift, 11/2026 → Mon 30.11.2026 (clamped, already a working day)", () => {
    expect(anchor(rule({ kind: "dayOfMonth", day: 31 }, { weekendShift: "next-working-day" }), "2026-11", NONE).local).toBe("2026-11-30 12:00");
  });

  it("T10: dayOfMonth(15), previous-working-day shift, 08/2026 → Fri 14.08.2026 (15.08. is a Saturday and a holiday)", () => {
    expect(anchor(rule({ kind: "dayOfMonth", day: 15 }, { weekendShift: "previous-working-day" }), "2026-08", NONE).local).toBe("2026-08-14 12:00");
  });
});

describe("§6.2b reference results T11–T17 (task due dates from the demo provider's anchor)", () => {
  const due = (anchorDate: string, amount: number, calendar: WorkingDayCalendar) => {
    const dueAt = resolveDueAt(zonedToUtc(anchorDate, "12:00"), { offset: { amount, unit: "workingDays" } }, calendar);
    return `${localDateOf(dueAt)} ${localTimeOf(dueAt)}`;
  };

  it.each<[string, string, WorkingDayCalendar, number, string]>([
    ["T11", "2026-11-23", NONE, -6, "2026-11-13"],
    ["T12", "2026-11-23", NONE, 0, "2026-11-23"],
    ["T13", "2026-12-21", D2, -2, "2026-12-17"],
    ["T14", "2026-12-21", D2, 2, "2026-12-23"],
    ["T15", "2026-12-21", D2, 4, "2026-12-29"],
    ["T16", "2026-12-23", NONE, 2, "2026-12-28"],
    ["T17", "2026-12-23", NONE, 4, "2026-12-30"],
  ])("%s: anchor %s, offset %i WD → %s 12:00", (_id, anchorDate, calendar, amount, expected) => {
    expect(due(anchorDate, amount, calendar)).toBe(`${expected} 12:00`);
  });

  it("§6.3 worked example: anchor Mon 23.11. 12:00, −6 WD → Fri 13.11. 12:00 as a UTC instant", () => {
    expect(resolveDueAt("2026-11-23T11:00:00.000Z", { offset: { amount: -6, unit: "workingDays" } }, NONE)).toBe("2026-11-13T11:00:00.000Z");
  });
});

describe("working days (§6.1)", () => {
  it("excludes weekends, statutory holidays and company closures, and says why", () => {
    expect(isWorkingDay(NONE, "2026-11-23")).toBe(true);
    expect(nonWorkingReason(NONE, "2026-11-21")).toBe("weekend");
    expect(nonWorkingReason(NONE, "2026-12-08")).toBe("public-holiday");
    expect(nonWorkingReason(NONE, "2026-08-15")).toBe("public-holiday"); // also a Saturday
    expect(nonWorkingReason(D2, "2026-12-24")).toBe("company-closure");
    expect(isWorkingDay(NONE, "2026-12-24")).toBe(true); // 24.12. is not a statutory holiday
    expect(isWorkingDay(NONE, "2026-12-31")).toBe(true);
  });

  it("follows a configured working week", () => {
    const fourDays = { ...NONE, workingWeek: [1, 2, 3, 4] as WorkingDayCalendar["workingWeek"] };
    expect(isWorkingDay(fourDays, "2026-11-27")).toBe(false); // Friday
    expect(nextWorkingDay(fourDays, "2026-11-26")).toBe("2026-11-30");
    const sixDays = { ...NONE, workingWeek: [1, 2, 3, 4, 5, 6] as WorkingDayCalendar["workingWeek"] };
    expect(isWorkingDay(sixDays, "2026-11-28")).toBe(true);
  });

  it("next and previous working day are strictly after and before", () => {
    expect(nextWorkingDay(NONE, "2026-11-23")).toBe("2026-11-24");
    expect(nextWorkingDay(NONE, "2026-12-23")).toBe("2026-12-24");
    expect(nextWorkingDay(D2, "2026-12-23")).toBe("2026-12-28");
    expect(previousWorkingDay(NONE, "2027-01-04")).toBe("2026-12-31");
    expect(previousWorkingDay(D2, "2027-01-04")).toBe("2026-12-30");
  });

  it("anchor date is position 0: 0 WD is the anchor itself, also on a non-working day; −1 WD is the last working day strictly before", () => {
    expect(addWorkingDays(NONE, "2026-11-23", 0)).toBe("2026-11-23");
    expect(addWorkingDays(NONE, "2026-11-23", -1)).toBe("2026-11-20");
    expect(addWorkingDays(NONE, "2026-11-23", 1)).toBe("2026-11-24");
    // A manually moved anchor on Saturday 21.11.
    expect(addWorkingDays(NONE, "2026-11-21", 0)).toBe("2026-11-21");
    expect(addWorkingDays(NONE, "2026-11-21", -1)).toBe("2026-11-20");
    expect(addWorkingDays(NONE, "2026-11-21", 1)).toBe("2026-11-23");
    expect(() => addWorkingDays(NONE, "2026-11-23", 1.5)).toThrow(RangeError);
  });

  it("counts working days between dates with the same convention (working-day windows)", () => {
    expect(workingDaysBetween(NONE, "2026-11-19", "2026-11-23")).toBe(2); // Fri 20., Mon 23.
    expect(workingDaysBetween(NONE, "2026-11-21", "2026-11-23")).toBe(1);
    expect(workingDaysBetween(NONE, "2026-11-23", "2026-11-23")).toBe(0);
    expect(workingDaysBetween(NONE, "2026-11-23", "2026-11-19")).toBe(-2);
    expect(workingDaysBetween(D2, "2026-12-23", "2026-12-28")).toBe(1);
  });

  it("nthWorkingDay: the first working day of the month is number 1; impossible n gives null", () => {
    expect(nthWorkingDayOfMonth(NONE, 2026, 11, 1)).toBe("2026-11-02");
    expect(nthWorkingDayOfMonth(NONE, 2027, 1, 1)).toBe("2027-01-04");
    const december = workingDaysInMonth(D2, 2026, 12);
    expect(december).toHaveLength(19); // 23 weekdays minus 08.12., 25.12. (holidays), 24.12. and 31.12. (closures)
    expect(nthWorkingDayOfMonth(D2, 2026, 12, 19)).toBe("2026-12-30");
    expect(nthWorkingDayOfMonth(D2, 2026, 12, 20)).toBeNull();
    expect(nthWorkingDayOfMonth(D2, 2026, 12, 0)).toBeNull();
  });

  it("workingDaysBeforeMonthEnd: L is position 0; the result has exactly n working days of the month after it", () => {
    expect(workingDaysBeforeMonthEnd(NONE, 2026, 11, 0)).toBe("2026-11-30");
    for (const calendar of [NONE, D2, D3, D4]) {
      const result = workingDaysBeforeMonthEnd(calendar, 2026, 12, 5)!;
      const after = workingDaysInMonth(calendar, 2026, 12).filter((date) => date > result);
      expect(after).toHaveLength(5);
    }
    expect(workingDaysBeforeMonthEnd(D2, 2026, 12, 18)).toBe("2026-12-01");
    expect(workingDaysBeforeMonthEnd(D2, 2026, 12, 19)).toBeNull();
  });

  it("weekend shift for date-based rules", () => {
    expect(applyWeekendShift(NONE, "2026-11-21", "previous-working-day")).toBe("2026-11-20");
    expect(applyWeekendShift(NONE, "2026-11-21", "next-working-day")).toBe("2026-11-23");
    expect(applyWeekendShift(NONE, "2026-11-21", "none")).toBe("2026-11-21");
    expect(applyWeekendShift(NONE, "2026-11-23", "previous-working-day")).toBe("2026-11-23");
    // Holiday chains: 25.–27.12. are Fri holiday, Sat holiday, Sunday.
    expect(applyWeekendShift(D2, "2026-12-25", "next-working-day")).toBe("2026-12-28");
    expect(applyWeekendShift(D2, "2026-12-25", "previous-working-day")).toBe("2026-12-23");
  });

  it("reports an empty working week instead of looping", () => {
    const never = { ...NONE, workingWeek: [] as WorkingDayCalendar["workingWeek"] };
    expect(() => nextWorkingDay(never, "2026-11-23")).toThrow(RangeError);
  });
});

describe("Europe/Vienna conversion and DST (§6.8)", () => {
  it("resolves anchors on the DST change days to the correct UTC instant", () => {
    const march = resolvePeriodAnchor(rule({ kind: "dayOfMonth", day: 29 }), parsePeriodKey("2026-03", "monthly")!, NONE);
    const october = resolvePeriodAnchor(rule({ kind: "dayOfMonth", day: 25 }), parsePeriodKey("2026-10", "monthly")!, NONE);
    expect(march).toMatchObject({ ok: true, date: "2026-03-29", anchorAt: "2026-03-29T10:00:00.000Z" }); // CEST, UTC+2
    expect(october).toMatchObject({ ok: true, date: "2026-10-25", anchorAt: "2026-10-25T11:00:00.000Z" }); // CET, UTC+1
  });

  it("converts local times around both transitions", () => {
    expect(zonedToUtc("2026-03-29", "01:59")).toBe("2026-03-29T00:59:00.000Z");
    expect(zonedToUtc("2026-03-29", "03:00")).toBe("2026-03-29T01:00:00.000Z");
    // 02:30 does not exist on 29.03.2026: it moves forward to 03:30 CEST.
    expect(zonedToUtc("2026-03-29", "02:30")).toBe("2026-03-29T01:30:00.000Z");
    // 02:30 happens twice on 25.10.2026: the first one, in summer time, is used.
    expect(zonedToUtc("2026-10-25", "02:30")).toBe("2026-10-25T00:30:00.000Z");
    expect(zonedToUtc("2026-10-25", "03:00")).toBe("2026-10-25T02:00:00.000Z");
    expect(zonedToUtc("2026-10-24", "12:00")).toBe("2026-10-24T10:00:00.000Z");
  });

  it("keeps working-day due dates on the local date across a DST change", () => {
    // Anchor Mon 30.03.2026 12:00 CEST; −1 WD is Fri 27.03. 12:00 CET.
    expect(resolveDueAt("2026-03-30T10:00:00.000Z", { offset: { amount: -1, unit: "workingDays" } }, NONE)).toBe("2026-03-27T11:00:00.000Z");
    // Anchor Mon 26.10.2026 is a holiday: still position 0. −1 WD is Fri 23.10. 12:00 CEST.
    expect(resolveDueAt("2026-10-26T11:00:00.000Z", { offset: { amount: -1, unit: "workingDays" } }, NONE)).toBe("2026-10-23T10:00:00.000Z");
  });

  it("uses the Vienna date at midnight boundaries, not the UTC date (no off-by-one day)", () => {
    // 23:30 UTC on Sunday 22.11. is already Monday 23.11. 00:30 in Vienna.
    const anchorAt = "2026-11-22T23:30:00.000Z";
    expect(localDateOf(anchorAt)).toBe("2026-11-23");
    expect(resolveDueAt(anchorAt, { offset: { amount: -1, unit: "workingDays" } }, NONE)).toBe("2026-11-19T23:30:00.000Z"); // Fri 20.11. 00:30
    expect(resolveDueAt(anchorAt, { offset: { amount: 0, unit: "workingDays" }, dueTime: "16:00" }, NONE)).toBe("2026-11-23T15:00:00.000Z");
  });
});

describe("no dependency on the workstation's time zone", () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    process.env.TZ = originalTz;
  });

  function referenceResults() {
    const cutoff = monthlySchedule();
    const report = rule({ kind: "nthWorkingDay", n: 3 }, { anchorPeriodOffset: 1, time: "10:00" });
    return [
      anchor(cutoff, "2026-11", NONE).utc,
      anchor(cutoff, "2026-12", D2).utc,
      anchor(report, "2026-12", NONE).utc,
      resolveDueAt("2026-12-21T11:00:00.000Z", { offset: { amount: 4, unit: "workingDays" } }, D2),
      zonedToUtc("2026-03-29", "02:30"),
      zonedToUtc("2026-10-25", "02:30"),
    ];
  }

  it.each<[string, number]>([["UTC", 0], ["America/Los_Angeles", 480], ["Asia/Tokyo", -540], ["Pacific/Kiritimati", -840]])(
    "gives the same instants with TZ=%s",
    (tz, offsetMinutes) => {
      const expected = referenceResults();
      process.env.TZ = tz;
      // The process really runs in the other zone now (otherwise the test would prove nothing).
      expect(new Date("2026-01-15T12:00:00.000Z").getTimezoneOffset()).toBe(offsetMinutes);
      expect(referenceResults()).toEqual(expected);
      expect(expected[0]).toBe("2026-11-23T11:00:00.000Z");
    },
  );
});

describe("module boundary (§6.1a)", () => {
  /** Module specifiers a source file imports or re-exports. */
  const imports = (file: string) =>
    [...readFileSync(file, "utf8").matchAll(/^(?:import|export)\s[^;]*?from\s+"([^"]+)"/gms)].map((match) => match[1]);

  it("working-days does not import working-hours, directly or through its own imports", () => {
    const seen = new Set<string>();
    const visit = (file: string) => {
      if (seen.has(file)) return;
      seen.add(file);
      for (const specifier of imports(file)) {
        expect(specifier).not.toMatch(/working-hours/);
        if (specifier.startsWith(".")) visit(resolve(file, "..", `${specifier}.ts`));
      }
    };
    visit(resolve(__dirname, "../lib/calendar/working-days.ts"));
    expect(seen.size).toBeGreaterThan(2);
  });

  it("working-hours asks working-days whether a date is a working day", () => {
    expect(imports(resolve(__dirname, "../lib/calendar/working-hours.ts"))).toContain("./working-days");
  });
});
