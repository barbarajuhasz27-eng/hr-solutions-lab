/**
 * Calendar-date arithmetic and Europe/Vienna conversion (§6.2 step 3, §6.8).
 *
 * - `ISODate` values ("2026-11-23") are local calendar dates in Europe/Vienna. They are calculated with UTC
 *   arithmetic only, so nothing here depends on the workstation's time zone.
 * - Conversion between a local date and time and a UTC instant uses `Intl` with an explicit time zone and
 *   is DST-correct.
 *
 * Pure: no function reads the clock.
 */
import { localParts } from "../format";
import type { ISODate, ISODateTime, ISOWeekday } from "../domain/types";

const DAY_MS = 24 * 60 * 60_000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface DateParts {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
}

/** Parses a valid "YYYY-MM-DD" calendar date. Throws a RangeError for anything else, including 2026-02-30. */
export function parseIsoDate(date: ISODate): DateParts {
  const match = ISO_DATE.exec(date);
  if (!match) throw new RangeError(`Invalid ISO date: ${date}`);
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) throw new RangeError(`Invalid ISO date: ${date}`);
  return { year, month, day };
}

export function isIsoDate(value: unknown): value is ISODate {
  if (typeof value !== "string") return false;
  try {
    parseIsoDate(value);
    return true;
  } catch {
    return false;
  }
}

export function isTimeOfDay(value: unknown): value is string {
  return typeof value === "string" && HH_MM.test(value);
}

/** "08:30" → 510. */
export function minutesOfDay(time: string): number {
  const match = HH_MM.exec(time);
  if (!match) throw new RangeError(`Invalid time of day: ${time}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatIsoDateParts(year: number, month: number, day: number): ISODate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function toUtcMs(date: ISODate): number {
  const { year, month, day } = parseIsoDate(date);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): ISODate {
  const date = new Date(ms);
  return formatIsoDateParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addCalendarDays(date: ISODate, days: number): ISODate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
export function calendarDaysBetween(from: ISODate, to: ISODate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export function isoWeekday(date: ISODate): ISOWeekday {
  const day = new Date(toUtcMs(date)).getUTCDay();
  return (day === 0 ? 7 : day) as ISOWeekday;
}

export function compareIsoDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function monthStart(year: number, month: number): ISODate {
  return formatIsoDateParts(year, month, 1);
}

export function monthEnd(year: number, month: number): ISODate {
  return formatIsoDateParts(year, month, daysInMonth(year, month));
}

/** Day `day` of a month, clamped to the month length (31 → 30.11., 30 → 28.02.). */
export function clampedDate(year: number, month: number, day: number): ISODate {
  return formatIsoDateParts(year, month, Math.min(Math.max(1, day), daysInMonth(year, month)));
}

// ---------------------------------------------------------------------------
// Europe/Vienna ↔ UTC
// ---------------------------------------------------------------------------

/** The Europe/Vienna calendar date of an instant. */
export function localDateOf(instant: ISODateTime | Date): ISODate {
  const parts = localParts(instant);
  return formatIsoDateParts(parts.year, parts.month, parts.day);
}

/** The Europe/Vienna wall-clock time of an instant, "HH:mm". */
export function localTimeOf(instant: ISODateTime | Date): string {
  const parts = localParts(instant);
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`;
}

/** Offset of Europe/Vienna from UTC at an instant, in minutes (+60 in winter, +120 in summer). */
export function viennaOffsetMinutes(instantMs: number): number {
  const parts = localParts(new Date(instantMs));
  const wall = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const truncated = Math.floor(instantMs / 60_000) * 60_000;
  return Math.round((wall - truncated) / 60_000);
}

/**
 * The UTC instant of a Europe/Vienna local date and time (DST-correct).
 *
 * - On the fall-back day a repeated time (25.10.2026 02:30) resolves to its first occurrence, in summer time.
 * - On the spring-forward day a time that does not exist (29.03.2026 02:30) moves forward by the gap to
 *   03:30 summer time, as a wall clock would.
 */
export function zonedToUtc(date: ISODate, time: string): ISODateTime {
  const { year, month, day } = parseIsoDate(date);
  const minutes = minutesOfDay(time);
  const wall = Date.UTC(year, month - 1, day, Math.floor(minutes / 60), minutes % 60);
  const offsets = [...new Set([viennaOffsetMinutes(wall - DAY_MS), viennaOffsetMinutes(wall + DAY_MS)])];
  const matching = offsets
    .map((offset) => wall - offset * 60_000)
    .filter((candidate) => localDateOf(new Date(candidate)) === date && localTimeOf(new Date(candidate)) === time)
    .sort((a, b) => a - b);
  const instant = matching[0] ?? wall - viennaOffsetMinutes(wall - DAY_MS) * 60_000;
  return new Date(instant).toISOString();
}

/** Start of a Europe/Vienna local day as a UTC instant. */
export function startOfLocalDay(date: ISODate): ISODateTime {
  return zonedToUtc(date, "00:00");
}
