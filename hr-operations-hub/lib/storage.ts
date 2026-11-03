import { formatDuration } from "./engine";
import type { Activity } from "./model";
import { createSeedActivities, RESCUE_ACTIVITY_ID, RESCUE_LEAD_MINUTES } from "./seed";

export const STORAGE_KEY = "hr-operations-hub-demo-v2";
/** v1 stored a bare activity array without a timestamp. */
export const LEGACY_STORAGE_KEY = "hr-operations-hub-demo-v1";

/**
 * A saved demo is treated as stale once the visitor has been away for longer than this.
 * Within this window the demo clock simply keeps running, as it would in a real workspace.
 */
export const STALE_AFTER_MINUTES = 30;

export interface StoredDemo {
  version: 2;
  savedAt: string;
  /** True once the visitor has changed anything (ticked an action, set a hold, created an activity). */
  modified: boolean;
  activities: Activity[];
}

export interface LoadedDemo {
  activities: Activity[];
  modified: boolean;
  notice?: string;
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isActivityList(value: unknown): value is Activity[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        isValidDateString(item.startsAt) &&
        Array.isArray(item.actions) &&
        item.actions.every(
          (action: unknown) =>
            isRecord(action) &&
            typeof action.id === "string" &&
            typeof action.status === "string" &&
            Array.isArray(action.dependsOn),
        ),
    )
  );
}

function parse(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Moves every date in the demo forward by the same amount, preserving the relative timeline. */
export function shiftActivities(activities: Activity[], milliseconds: number): Activity[] {
  const shift = (iso: string) => new Date(new Date(iso).getTime() + milliseconds).toISOString();
  return activities.map((activity) => ({
    ...activity,
    startsAt: shift(activity.startsAt),
    ...(activity.completedAt ? { completedAt: shift(activity.completedAt) } : {}),
  }));
}

function freshDemo(now: Date): LoadedDemo {
  return { activities: createSeedActivities(now), modified: false };
}

/**
 * Decides what a (returning) visitor should see. Pure, so it can be unit-tested.
 *
 * - Nothing saved, or unreadable data: fresh demo.
 * - Saved recently: continue exactly where the visitor is — the clock keeps running.
 * - Stale and untouched: fresh demo. Nothing meaningful is lost.
 * - Stale with the visitor's own changes: keep the changes and move the whole timeline forward by the
 *   time they were away, so countdowns and recovery states look exactly as they left them.
 * - Legacy v1 data: kept and realigned so the lead scenario is back at its original 45-minute lead time.
 */
export function resolveStoredDemo(raw: string | null, legacyRaw: string | null, now: Date): LoadedDemo {
  const stored = parse(raw);
  if (
    isRecord(stored) &&
    stored.version === 2 &&
    isValidDateString(stored.savedAt) &&
    typeof stored.modified === "boolean" &&
    isActivityList(stored.activities)
  ) {
    const awayMs = Math.max(0, now.getTime() - new Date(stored.savedAt).getTime());
    const awayMinutes = awayMs / 60_000;
    if (awayMinutes <= STALE_AFTER_MINUTES) {
      return { activities: stored.activities, modified: stored.modified };
    }
    if (!stored.modified) return freshDemo(now);
    return {
      activities: shiftActivities(stored.activities, awayMs),
      modified: true,
      notice: `Welcome back. Your demo changes were kept and the demo timeline was moved forward by ${formatDuration(awayMinutes)}, so countdowns look as you left them. Use “Reset demo” to start the scenario fresh.`,
    };
  }

  const legacy = parse(legacyRaw);
  if (isActivityList(legacy)) {
    const rescue = legacy.find((activity) => activity.id === RESCUE_ACTIVITY_ID);
    if (rescue) {
      const seededAt = new Date(rescue.startsAt).getTime() - RESCUE_LEAD_MINUTES * 60_000;
      const shiftMs = Math.max(0, now.getTime() - seededAt);
      return {
        activities: shiftActivities(legacy, shiftMs),
        modified: true,
        notice: "Your earlier demo changes were kept and the demo timeline was realigned to today. Use “Reset demo” to start the scenario fresh.",
      };
    }
  }

  return freshDemo(now);
}

export function loadDemo(now: Date): LoadedDemo {
  if (typeof window === "undefined") return freshDemo(now);
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const legacyRaw = raw ? null : window.localStorage.getItem(LEGACY_STORAGE_KEY);
    const loaded = resolveStoredDemo(raw, legacyRaw, now);
    if (legacyRaw !== null) window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    return loaded;
  } catch {
    return freshDemo(now);
  }
}

export function saveDemo(activities: Activity[], modified: boolean, now: Date): void {
  if (typeof window === "undefined") return;
  const stored: StoredDemo = { version: 2, savedAt: now.toISOString(), modified, activities };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // The prototype remains usable in memory when browser storage is unavailable.
  }
}

export function clearDemo(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // No-op: the caller still restores the in-memory demo state.
  }
}
