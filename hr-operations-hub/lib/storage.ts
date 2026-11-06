/**
 * Legacy demo storage (v1 and v2). Read-only since M1: the app stores the v3 store
 * (`lib/store/persistence.ts`), and this module only resolves what an earlier version left behind, so
 * that migration (§11.2 step 2) can run the existing compatibility and stale-demo logic unchanged.
 */
import { formatDuration } from "./format";
import type { Activity } from "./model";
import { message } from "./messages/en";
import { createSeedActivities, RESCUE_ACTIVITY_ID, RESCUE_LEAD_MINUTES } from "./seed";

export const STORAGE_KEY = "hr-operations-hub-demo-v2";
export const V2_STORAGE_KEY = STORAGE_KEY;
/** v1 stored a bare activity array without a timestamp. */
export const LEGACY_STORAGE_KEY = "hr-operations-hub-demo-v1";
export const V1_STORAGE_KEY = LEGACY_STORAGE_KEY;

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
  /** Where the activities came from. "fresh" means nothing usable was stored. */
  source: "v2" | "v1" | "fresh";
  /**
   * The moment the activities reflect, on the returned (possibly shifted) timeline: the stored `savedAt`
   * moved by the same shift as the activities. For v1, which has no timestamp, the current time.
   */
  savedAt: string;
  /** Minutes by which the timeline was moved forward, when it was shifted. */
  shiftedMinutes?: number;
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
  return { activities: createSeedActivities(now), modified: false, source: "fresh", savedAt: now.toISOString() };
}

/**
 * Decides what a (returning) visitor of a v1/v2 demo should see. Pure, so it can be unit-tested.
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
      return { activities: stored.activities, modified: stored.modified, source: "v2", savedAt: stored.savedAt };
    }
    // Valid but untouched: a fresh demo. `source` still says v2 was read, so it is not reported as unreadable.
    if (!stored.modified) return { ...freshDemo(now), source: "v2" };
    return {
      activities: shiftActivities(stored.activities, awayMs),
      modified: true,
      source: "v2",
      savedAt: now.toISOString(),
      shiftedMinutes: awayMinutes,
      notice: [
        message("notice.welcome-back"),
        message("notice.timeline-shifted", { duration: formatDuration(awayMinutes) }),
        message("notice.reset-hint"),
      ].join(" "),
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
        source: "v1",
        savedAt: now.toISOString(),
        shiftedMinutes: shiftMs / 60_000,
        notice: `${message("notice.timeline-realigned")} ${message("notice.reset-hint")}`,
      };
    }
  }

  return freshDemo(now);
}
