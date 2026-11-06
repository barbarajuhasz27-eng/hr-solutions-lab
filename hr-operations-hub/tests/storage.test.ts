import { describe, expect, it } from "vitest";
import { getReadiness } from "../lib/engine";
import type { Activity } from "../lib/model";
import { createSeedActivities, RESCUE_ACTIVITY_ID } from "../lib/seed";
import { resolveStoredDemo, shiftActivities, STALE_AFTER_MINUTES, type StoredDemo } from "../lib/storage";

const MINUTE = 60_000;
const savedAt = new Date("2026-11-03T10:00:00.000Z");

function stored(activities: Activity[], modified: boolean): string {
  const demo: StoredDemo = { version: 2, savedAt: savedAt.toISOString(), modified, activities };
  return JSON.stringify(demo);
}

function rescueOf(activities: Activity[]): Activity {
  return activities.find((activity) => activity.id === RESCUE_ACTIVITY_ID)!;
}

function minutesUntilStart(activity: Activity, now: Date) {
  return (new Date(activity.startsAt).getTime() - now.getTime()) / MINUTE;
}

/** Seed data with the trainer confirmed, i.e. a visitor change worth keeping. */
function modifiedSeed(): Activity[] {
  return createSeedActivities(savedAt).map((activity) =>
    activity.id !== RESCUE_ACTIVITY_ID
      ? activity
      : {
          ...activity,
          actions: activity.actions.map((action) =>
            action.id === "trainer-confirmed" ? { ...action, status: "done" as const } : action,
          ),
        },
  );
}

describe("loading the demo for returning visitors", () => {
  it("seeds a fresh demo when nothing is stored", () => {
    const now = new Date("2026-11-05T08:00:00.000Z");
    const loaded = resolveStoredDemo(null, null, now);
    expect(loaded.modified).toBe(false);
    expect(minutesUntilStart(rescueOf(loaded.activities), now)).toBe(45);
  });

  it("seeds a fresh demo when the stored data is unreadable", () => {
    const now = new Date();
    expect(resolveStoredDemo("{not json", null, now).modified).toBe(false);
    expect(resolveStoredDemo(JSON.stringify({ version: 2, savedAt: "x", modified: true, activities: [] }), null, now).modified).toBe(false);
  });

  it("continues unchanged when the visitor returns shortly after", () => {
    const activities = modifiedSeed();
    const now = new Date(savedAt.getTime() + 10 * MINUTE);
    const loaded = resolveStoredDemo(stored(activities, true), null, now);
    expect(loaded.activities).toEqual(activities);
    expect(loaded.notice).toBeUndefined();
  });

  it("replaces a stale, untouched demo with a fresh one", () => {
    const now = new Date(savedAt.getTime() + 2 * 24 * 60 * MINUTE);
    const loaded = resolveStoredDemo(stored(createSeedActivities(savedAt), false), null, now);
    expect(loaded.modified).toBe(false);
    expect(minutesUntilStart(rescueOf(loaded.activities), now)).toBe(45);
    expect(getReadiness(rescueOf(loaded.activities), now).status).toBe("recovery");
  });

  it("keeps a stale demo's changes and shifts its timeline so countdowns look as the visitor left them", () => {
    const now = new Date(savedAt.getTime() + 3 * 24 * 60 * MINUTE);
    const loaded = resolveStoredDemo(stored(modifiedSeed(), true), null, now);
    const rescue = rescueOf(loaded.activities);
    expect(loaded.modified).toBe(true);
    expect(minutesUntilStart(rescue, now)).toBe(45);
    expect(rescue.actions.find((action) => action.id === "trainer-confirmed")?.status).toBe("done");
    expect(getReadiness(rescue, now).status).toBe("recovery");
    // M1: durations now come from lib/format.ts in the §8.6 style ("3 d", formerly "3d").
    expect(loaded.notice).toContain("3 d");
  });

  it("only treats a demo as stale after the configured absence", () => {
    const justInside = new Date(savedAt.getTime() + STALE_AFTER_MINUTES * MINUTE);
    const justOutside = new Date(savedAt.getTime() + (STALE_AFTER_MINUTES + 1) * MINUTE);
    expect(resolveStoredDemo(stored(modifiedSeed(), true), null, justInside).notice).toBeUndefined();
    expect(resolveStoredDemo(stored(modifiedSeed(), true), null, justOutside).notice).toBeDefined();
  });

  it("migrates legacy v1 data, keeping changes and realigning the lead scenario to 45 minutes", () => {
    const now = new Date(savedAt.getTime() + 24 * 60 * MINUTE);
    const loaded = resolveStoredDemo(null, JSON.stringify(modifiedSeed()), now);
    const rescue = rescueOf(loaded.activities);
    expect(loaded.modified).toBe(true);
    expect(minutesUntilStart(rescue, now)).toBe(45);
    expect(rescue.actions.find((action) => action.id === "trainer-confirmed")?.status).toBe("done");
  });

  it("shifts start and completion dates together", () => {
    const completed = createSeedActivities(savedAt).find((activity) => activity.completedAt)!;
    const [shifted] = shiftActivities([completed], 60 * MINUTE);
    expect(new Date(shifted.startsAt).getTime() - new Date(completed.startsAt).getTime()).toBe(60 * MINUTE);
    expect(new Date(shifted.completedAt!).getTime() - new Date(completed.completedAt!).getTime()).toBe(60 * MINUTE);
  });
});
