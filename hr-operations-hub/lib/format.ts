/**
 * The one module that formats everything visible (§8.6, D4): `DD.MM.YYYY`, short `DD.MM.`, 24-hour
 * `HH:mm`, two-letter weekdays, ISO calendar weeks ("KW 45") and durations ("2 d 4 h", "45 min").
 *
 * Every instant is shown in Europe/Vienna, independent of the browser's time zone. Components must not
 * format dates themselves.
 */
import type { ISODate, ISOWeekday } from "./domain/types";

export const FORMAT_SETTINGS = { locale: "en-GB", timeZone: "Europe/Vienna", weekStartsOn: 1 } as const;

type Instant = Date | string | number;

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: ISOWeekday;
}

const partsFormatter = new Intl.DateTimeFormat(FORMAT_SETTINGS.locale, {
  timeZone: FORMAT_SETTINGS.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAY_FROM_EN: Record<string, ISOWeekday> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const WEEKDAY_SHORT: Record<ISOWeekday, string> = { 1: "Mo", 2: "Tu", 3: "We", 4: "Th", 5: "Fr", 6: "Sa", 7: "Su" };
const WEEKDAY_LONG: Record<ISOWeekday, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

function toDate(value: Instant): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new RangeError(`Invalid instant: ${String(value)}`);
  return date;
}

const pad = (value: number) => String(value).padStart(2, "0");

/** Calendar parts of an instant in Europe/Vienna. DST-correct, independent of the host time zone. */
export function localParts(value: Instant): LocalParts {
  const parts = Object.fromEntries(partsFormatter.formatToParts(toDate(value)).map((part) => [part.type, part.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAY_FROM_EN[parts.weekday],
  };
}

/** The Europe/Vienna calendar date of an instant, "YYYY-MM-DD". */
export function localDate(value: Instant): ISODate {
  const { year, month, day } = localParts(value);
  return `${year}-${pad(month)}-${pad(day)}`;
}

function parseIsoDate(date: ISODate): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new RangeError(`Invalid ISO date: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** "DD.MM.YYYY" */
export function formatDate(value: Instant): string {
  const { year, month, day } = localParts(value);
  return `${pad(day)}.${pad(month)}.${year}`;
}

/** "DD.MM." */
export function formatShortDate(value: Instant): string {
  const { month, day } = localParts(value);
  return `${pad(day)}.${pad(month)}.`;
}

/** "HH:mm", 24-hour. */
export function formatTime(value: Instant): string {
  const { hour, minute } = localParts(value);
  return `${pad(hour)}:${pad(minute)}`;
}

/** "Mo", "Tu", … */
export function formatWeekday(value: Instant): string {
  return WEEKDAY_SHORT[localParts(value).weekday];
}

/** "Monday", "Tuesday", … */
export function formatWeekdayLong(value: Instant): string {
  return WEEKDAY_LONG[localParts(value).weekday];
}

/** "Tuesday, 03.11.2026" */
export function formatLongDate(value: Instant): string {
  return `${formatWeekdayLong(value)}, ${formatDate(value)}`;
}

/** "DD.MM.YYYY HH:mm" */
export function formatDateTime(value: Instant): string {
  return `${formatDate(value)} ${formatTime(value)}`;
}

/** "Fr 13.11. 12:00" */
export function formatShortDateTime(value: Instant): string {
  return `${formatWeekday(value)} ${formatShortDate(value)} ${formatTime(value)}`;
}

/** "DD.MM.YYYY" for a calendar date without a time (holidays, closures, unavailability). */
export function formatIsoDate(date: ISODate): string {
  const { year, month, day } = parseIsoDate(date);
  return `${pad(day)}.${pad(month)}.${year}`;
}

/** ISO 8601 week of a calendar date. The week year can differ from the calendar year around New Year. */
export function isoWeekOfDate(date: ISODate): { weekYear: number; week: number } {
  const { year, month, day } = parseIsoDate(date);
  const utc = new Date(Date.UTC(year, month - 1, day));
  const weekday = utc.getUTCDay() || 7;
  // The Thursday of the same ISO week decides the week year.
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const weekYear = utc.getUTCFullYear();
  const firstDay = Date.UTC(weekYear, 0, 1);
  const week = Math.ceil(((utc.getTime() - firstDay) / 86_400_000 + 1) / 7);
  return { weekYear, week };
}

/** ISO week of an instant, using its Europe/Vienna calendar date. */
export function isoWeek(value: Instant): { weekYear: number; week: number } {
  return isoWeekOfDate(localDate(value));
}

/** "KW 45" */
export function formatCalendarWeek(value: Instant): string {
  return `KW ${isoWeek(value).week}`;
}

/**
 * Human-readable duration from minutes: "45 min", "3 h", "3 h 20 min", "2 d", "2 d 4 h".
 * Negative values are shown as zero; callers phrase "ago" or "overdue" themselves.
 */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.floor(totalMinutes));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 24 * 60) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  const days = Math.floor(minutes / (24 * 60));
  const hours = Math.floor((minutes % (24 * 60)) / 60);
  return hours ? `${days} d ${hours} h` : `${days} d`;
}
