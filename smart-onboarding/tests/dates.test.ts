import { describe, expect, it } from "vitest";
import {
  addDays,
  diffInDays,
  formatRelative,
  isValidISODate,
  parseISODate,
  toISODate,
} from "@/lib/dates";

describe("addDays", () => {
  it("crosses month boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-04-30", 30)).toBe("2026-05-30");
  });

  it("crosses year boundaries in both directions", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-05", -10)).toBe("2026-12-26");
    expect(addDays("2026-11-15", 90)).toBe("2027-02-13");
  });

  it("handles leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-03-01", -1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  });

  it("is not shifted by daylight-saving transitions", () => {
    // Europe/Berlin switches clocks on 29 Mar 2026 and 25 Oct 2026.
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-03-29", 1)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("returns the same date for a zero offset", () => {
    expect(addDays("2026-07-14", 0)).toBe("2026-07-14");
  });
});

describe("diffInDays", () => {
  it("counts calendar days, including across DST and year ends", () => {
    expect(diffInDays("2026-03-28", "2026-03-30")).toBe(2);
    expect(diffInDays("2026-10-24", "2026-10-26")).toBe(2);
    expect(diffInDays("2026-12-30", "2027-01-02")).toBe(3);
    expect(diffInDays("2027-01-02", "2026-12-30")).toBe(-3);
  });
});

describe("parsing and formatting", () => {
  it("formats local dates without UTC drift", () => {
    expect(toISODate(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    expect(toISODate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it("rejects malformed and overflowing dates", () => {
    expect(parseISODate("2026-02-31")).toBeNull();
    expect(parseISODate("2026-13-01")).toBeNull();
    expect(parseISODate("26-01-01")).toBeNull();
    expect(isValidISODate("not a date")).toBe(false);
    expect(isValidISODate(20260101)).toBe(false);
    expect(isValidISODate("2028-02-29")).toBe(true);
  });

  it("describes relative dates", () => {
    expect(formatRelative("2026-11-02", "2026-11-02")).toBe("Today");
    expect(formatRelative("2026-11-03", "2026-11-02")).toBe("Tomorrow");
    expect(formatRelative("2026-11-01", "2026-11-02")).toBe("Yesterday");
    expect(formatRelative("2026-11-12", "2026-11-02")).toBe("In 10 days");
    expect(formatRelative("2026-10-28", "2026-11-02")).toBe("5 days ago");
  });
});
