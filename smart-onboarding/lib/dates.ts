import type { ISODate } from "@/types/onboarding";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** Formats a Date as a local calendar date (YYYY-MM-DD), ignoring the time zone offset. */
export function toISODate(date: Date): ISODate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses YYYY-MM-DD as a local date at midnight. Returns null for invalid input. */
export function parseISODate(value: string): Date | null {
  const match = ISO_DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  // Reject overflow such as 2026-02-31.
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  return date;
}

export function isValidISODate(value: unknown): value is ISODate {
  return typeof value === "string" && parseISODate(value) !== null;
}

function mustParse(value: ISODate): Date {
  const date = parseISODate(value);
  if (!date) throw new Error(`Invalid ISO date: ${value}`);
  return date;
}

/** Adds calendar days in local time. Handles month/year boundaries and DST safely. */
export function addDays(value: ISODate, days: number): ISODate {
  const date = mustParse(value);
  return toISODate(new Date(date.getFullYear(), date.getMonth(), date.getDate() + days));
}

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export function diffInDays(from: ISODate, to: ISODate): number {
  const a = mustParse(from);
  const b = mustParse(to);
  // Compare UTC equivalents to avoid off-by-one errors around DST transitions.
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcB - utcA) / DAY_MS);
}

export function todayISO(now: Date = new Date()): ISODate {
  return toISODate(now);
}

const longFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const shortFormatter = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** e.g. "14 Nov 2026" */
export function formatDate(value: ISODate): string {
  const date = parseISODate(value);
  return date ? longFormatter.format(date) : value;
}

/** e.g. "14 Nov" */
export function formatShortDate(value: ISODate): string {
  const date = parseISODate(value);
  return date ? shortFormatter.format(date) : value;
}

/** e.g. "Monday 2 November 2026" */
export function formatLongDate(value: ISODate): string {
  const date = parseISODate(value);
  return date ? weekdayFormatter.format(date) : value;
}

/** Human-friendly relative label: "Today", "Tomorrow", "In 5 days", "3 days ago". */
export function formatRelative(value: ISODate, today: ISODate): string {
  const days = diffInDays(today, value);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}
