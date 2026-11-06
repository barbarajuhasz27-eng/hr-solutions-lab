/** lib/format.ts (§8.6, D4): Europe/Vienna, DD.MM.YYYY, 24 h, ISO calendar weeks, durations. */
import { describe, expect, it } from "vitest";
import {
  FORMAT_SETTINGS,
  formatCalendarWeek,
  formatDate,
  formatDateTime,
  formatDuration,
  formatIsoDate,
  formatLongDate,
  formatShortDate,
  formatShortDateTime,
  formatTime,
  formatWeekday,
  isoWeek,
  isoWeekOfDate,
  localDate,
  localParts,
} from "../lib/format";

describe("settings", () => {
  it("uses en-GB, Europe/Vienna and weeks starting on Monday", () => {
    expect(FORMAT_SETTINGS).toEqual({ locale: "en-GB", timeZone: "Europe/Vienna", weekStartsOn: 1 });
  });
});

describe("dates and times in Europe/Vienna", () => {
  // 23.11.2026 11:00 UTC = 12:00 CET (UTC+1).
  const cutoff = "2026-11-23T11:00:00.000Z";

  it("formats DD.MM.YYYY, DD.MM., HH:mm and short weekdays", () => {
    expect(formatDate(cutoff)).toBe("23.11.2026");
    expect(formatShortDate(cutoff)).toBe("23.11.");
    expect(formatTime(cutoff)).toBe("12:00");
    expect(formatWeekday(cutoff)).toBe("Mo");
    expect(formatDateTime(cutoff)).toBe("23.11.2026 12:00");
    expect(formatShortDateTime("2026-11-13T11:00:00.000Z")).toBe("Fr 13.11. 12:00");
    expect(formatLongDate("2026-11-03T09:00:00.000Z")).toBe("Tuesday, 03.11.2026");
  });

  it("pads single digits and uses the 24-hour clock", () => {
    expect(formatDate("2027-01-04T08:05:00.000Z")).toBe("04.01.2027");
    expect(formatTime("2026-11-04T23:05:00.000Z")).toBe("00:05");
    expect(formatTime("2026-11-04T12:59:00.000Z")).toBe("13:59");
    expect(formatTime("2026-11-04T22:59:00.000Z")).toBe("23:59");
  });

  it("uses the Vienna date, not the UTC date, around midnight", () => {
    expect(localDate("2026-12-31T23:30:00.000Z")).toBe("2027-01-01");
    expect(formatDate("2026-12-31T23:30:00.000Z")).toBe("01.01.2027");
    expect(formatWeekday("2026-12-31T23:30:00.000Z")).toBe("Fr");
    expect(localDate("2026-07-15T21:59:00.000Z")).toBe("2026-07-15"); // 23:59 CEST
    expect(localDate("2026-07-15T22:00:00.000Z")).toBe("2026-07-16"); // 00:00 CEST
  });

  it("accepts Date objects, ISO strings and epoch milliseconds, and rejects invalid instants", () => {
    const date = new Date("2026-11-23T11:00:00.000Z");
    expect(formatTime(date)).toBe("12:00");
    expect(formatTime(date.getTime())).toBe("12:00");
    expect(() => formatDate("not a date")).toThrow(RangeError);
  });

  it("formats calendar dates without a time", () => {
    expect(formatIsoDate("2026-12-24")).toBe("24.12.2026");
    expect(() => formatIsoDate("24.12.2026")).toThrow(RangeError);
  });
});

describe("DST boundaries (§6.8)", () => {
  it("spring forward, 29.03.2026: 02:00 CET jumps to 03:00 CEST", () => {
    expect(formatTime("2026-03-29T00:59:00.000Z")).toBe("01:59"); // CET, UTC+1
    expect(formatTime("2026-03-29T01:00:00.000Z")).toBe("03:00"); // CEST, UTC+2
    expect(formatTime("2026-03-29T10:00:00.000Z")).toBe("12:00");
    expect(formatTime("2026-03-28T11:00:00.000Z")).toBe("12:00"); // the day before: UTC+1
    expect(formatDate("2026-03-29T01:00:00.000Z")).toBe("29.03.2026");
  });

  it("fall back, 25.10.2026: 03:00 CEST returns to 02:00 CET", () => {
    expect(formatTime("2026-10-25T00:59:00.000Z")).toBe("02:59"); // CEST, UTC+2
    expect(formatTime("2026-10-25T01:00:00.000Z")).toBe("02:00"); // CET, UTC+1
    expect(formatTime("2026-10-25T11:00:00.000Z")).toBe("12:00");
    expect(formatTime("2026-10-24T10:00:00.000Z")).toBe("12:00"); // the day before: UTC+2
  });

  it("reports local parts consistently across the change", () => {
    expect(localParts("2026-03-29T01:30:00.000Z")).toEqual({ year: 2026, month: 3, day: 29, hour: 3, minute: 30, weekday: 7 });
    expect(localParts("2026-10-25T01:30:00.000Z")).toEqual({ year: 2026, month: 10, day: 25, hour: 2, minute: 30, weekday: 7 });
  });
});

describe("ISO calendar weeks (§6.8)", () => {
  it.each([
    ["2026-11-03", 2026, 45],
    ["2026-12-31", 2026, 53],
    ["2027-01-01", 2026, 53],
    ["2027-01-03", 2026, 53],
    ["2027-01-04", 2027, 1],
    ["2026-01-01", 2026, 1],
    ["2025-12-29", 2026, 1],
    ["2026-03-29", 2026, 13],
  ])("%s is KW %i/%i", (date, weekYear, week) => {
    expect(isoWeekOfDate(date)).toEqual({ weekYear, week });
  });

  it("formats 'KW n' from the Vienna date of an instant", () => {
    expect(formatCalendarWeek("2026-11-03T09:00:00.000Z")).toBe("KW 45");
    // Sunday 03.01.2027 23:30 UTC is already Monday 04.01.2027 in Vienna.
    expect(isoWeek("2027-01-03T23:30:00.000Z")).toEqual({ weekYear: 2027, week: 1 });
    expect(formatCalendarWeek("2027-01-03T22:30:00.000Z")).toBe("KW 53");
  });
});

describe("durations", () => {
  it.each([
    [0, "0 min"],
    [45, "45 min"],
    [59.9, "59 min"],
    [60, "1 h"],
    [200, "3 h 20 min"],
    [24 * 60, "1 d"],
    [2 * 24 * 60 + 4 * 60, "2 d 4 h"],
    [2 * 24 * 60 + 4 * 60 + 30, "2 d 4 h"],
    [-15, "0 min"],
  ])("%d minutes → %s", (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});
