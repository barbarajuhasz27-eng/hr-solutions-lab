/**
 * Schedule periods and their keys (§6.8): monthly `YYYY-MM`, weekly `YYYY-Www` (ISO week-year), quarterly
 * `YYYY-Qn`, annual `YYYY`, one-off `once`. Pure calendar arithmetic; no time of day, no time zone.
 */
import { isoWeekOfDate } from "../format";
import type { ISODate, ScheduleFrequency } from "../domain/types";
import { addCalendarDays, formatIsoDateParts, isoWeekday, monthEnd, parseIsoDate } from "./dates";

export interface Period {
  frequency: ScheduleFrequency;
  /** Calendar year, or the ISO week-year for weekly periods. */
  year: number;
  /** Month 1–12, quarter 1–4, ISO week 1–53, or 1 for annual periods. */
  index: number;
}

/** The ISO week-year's first Monday (the Monday of the week that contains 4 January). */
function isoWeekOneMonday(weekYear: number): ISODate {
  const jan4 = formatIsoDateParts(weekYear, 1, 4);
  return addCalendarDays(jan4, 1 - isoWeekday(jan4));
}

export function periodKey(period: Period): string {
  const year = String(period.year).padStart(4, "0");
  switch (period.frequency) {
    case "monthly":
      return `${year}-${String(period.index).padStart(2, "0")}`;
    case "weekly":
      return `${year}-W${String(period.index).padStart(2, "0")}`;
    case "quarterly":
      return `${year}-Q${period.index}`;
    case "annually":
      return year;
  }
}

const KEY_PATTERNS: Record<ScheduleFrequency, RegExp> = {
  monthly: /^(\d{4})-(0[1-9]|1[0-2])$/,
  weekly: /^(\d{4})-W(0[1-9]|[1-4]\d|5[0-3])$/,
  quarterly: /^(\d{4})-Q([1-4])$/,
  annually: /^(\d{4})$/,
};

/** Parses a period key of the given frequency, or returns null when it is malformed. */
export function parsePeriodKey(key: string, frequency: ScheduleFrequency): Period | null {
  const match = KEY_PATTERNS[frequency].exec(key);
  if (!match) return null;
  const period: Period = { frequency, year: Number(match[1]), index: frequency === "annually" ? 1 : Number(match[2]) };
  // "2027-W53" does not exist: 2027 has 52 ISO weeks.
  if (frequency === "weekly" && periodKey(periodOfDate("weekly", periodStart(period))) !== key) return null;
  return period;
}

/** The period of the given frequency that contains a local date. */
export function periodOfDate(frequency: ScheduleFrequency, date: ISODate): Period {
  const { year, month } = parseIsoDate(date);
  switch (frequency) {
    case "monthly":
      return { frequency, year, index: month };
    case "quarterly":
      return { frequency, year, index: Math.ceil(month / 3) };
    case "annually":
      return { frequency, year, index: 1 };
    case "weekly": {
      const { weekYear, week } = isoWeekOfDate(date);
      return { frequency, year: weekYear, index: week };
    }
  }
}

/** First local date of a period (the Monday for weekly periods). */
export function periodStart(period: Period): ISODate {
  switch (period.frequency) {
    case "monthly":
      return formatIsoDateParts(period.year, period.index, 1);
    case "quarterly":
      return formatIsoDateParts(period.year, (period.index - 1) * 3 + 1, 1);
    case "annually":
      return formatIsoDateParts(period.year, 1, 1);
    case "weekly":
      return addCalendarDays(isoWeekOneMonday(period.year), (period.index - 1) * 7);
  }
}

/** Last local date of a period (the Sunday for weekly periods). */
export function periodEnd(period: Period): ISODate {
  switch (period.frequency) {
    case "monthly":
      return monthEnd(period.year, period.index);
    case "quarterly":
      return monthEnd(period.year, period.index * 3);
    case "annually":
      return formatIsoDateParts(period.year, 12, 31);
    case "weekly":
      return addCalendarDays(periodStart(period), 6);
  }
}

/** A continuous counter of periods, so that `ordinal(b) − ordinal(a)` is the number of periods between them. */
export function periodOrdinal(period: Period): number {
  switch (period.frequency) {
    case "monthly":
      return period.year * 12 + (period.index - 1);
    case "quarterly":
      return period.year * 4 + (period.index - 1);
    case "annually":
      return period.year;
    case "weekly":
      // Days from a fixed Monday (01.01.2001), in weeks.
      return Math.round((Date.parse(`${periodStart(period)}T00:00:00Z`) - Date.parse("2001-01-01T00:00:00Z")) / (7 * 86_400_000));
  }
}

/** The period `steps` periods after (or, when negative, before) the given one. */
export function addPeriods(period: Period, steps: number): Period {
  if (steps === 0) return period;
  switch (period.frequency) {
    case "monthly": {
      const ordinal = periodOrdinal(period) + steps;
      return { frequency: "monthly", year: Math.floor(ordinal / 12), index: (((ordinal % 12) + 12) % 12) + 1 };
    }
    case "quarterly": {
      const ordinal = periodOrdinal(period) + steps;
      return { frequency: "quarterly", year: Math.floor(ordinal / 4), index: (((ordinal % 4) + 4) % 4) + 1 };
    }
    case "annually":
      return { frequency: "annually", year: period.year + steps, index: 1 };
    case "weekly":
      return periodOfDate("weekly", addCalendarDays(periodStart(period), steps * 7));
  }
}
