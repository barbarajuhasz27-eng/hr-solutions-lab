import { describe, expect, it } from "vitest";
import { getReadiness, holdUpdate, applyActionUpdate, isActionResolved, getActionDueAt } from "../lib/engine";
import { createActivity, createSeedActivities, RESCUE_ACTIVITY_ID } from "../lib/seed";
import {
  filterHref,
  getAtRiskActivities,
  getExceptionCounts,
  getOverdueTasks,
  getWaitingTasks,
  occurrenceHref,
  parseExceptionFilter,
  recoveryHref,
} from "../lib/shell";

const now = new Date("2026-11-04T09:00:00.000Z");

describe("M0 shell adapter: exception counts", () => {
  it("derives every counter from the demo data and existing engine rules", () => {
    const activities = createSeedActivities(now);
    const counts = getExceptionCounts(activities, now);

    const expectedOverdue = activities.flatMap((activity) =>
      activity.actions.filter((action) => !isActionResolved(action) && getActionDueAt(activity.startsAt, action.dueOffsetMinutes) < now),
    ).length;
    const expectedAtRisk = activities.filter((activity) => ["at-risk", "recovery"].includes(getReadiness(activity, now).status)).length;

    expect(counts.overdue).toBe(expectedOverdue);
    expect(counts.overdue).toBeGreaterThan(0);
    expect(counts["at-risk"]).toBe(expectedAtRisk);
    expect(counts["at-risk"]).toBe(1);
    expect(counts.waiting).toBe(0);
  });

  it("counts a Waiting hold as soon as one is set, and stops when it is released", () => {
    const seeded = createSeedActivities(now);
    const withHold = applyActionUpdate(seeded, RESCUE_ACTIVITY_ID, "room-confirmed", holdUpdate({ kind: "waiting", waitingOn: "Facilities" }));
    expect(getExceptionCounts(withHold, now).waiting).toBe(1);
    expect(getWaitingTasks(withHold).map((ref) => ref.action.id)).toEqual(["room-confirmed"]);

    const blocked = applyActionUpdate(seeded, RESCUE_ACTIVITY_ID, "room-confirmed", holdUpdate({ kind: "blocked", note: "Room double-booked" }));
    expect(getExceptionCounts(blocked, now).waiting).toBe(0);
  });

  it("is zero everywhere for a fully prepared activity far in the future", () => {
    const ready = createActivity("training-session", "Ready session", new Date(now.getTime() + 30 * 24 * 60 * 60_000), "ready", { complete: true });
    expect(getExceptionCounts([ready], now)).toEqual({ overdue: 0, "at-risk": 0, waiting: 0 });
  });

  it("lists overdue tasks oldest due time first, and at-risk activities by start", () => {
    const activities = createSeedActivities(now);
    const overdue = getOverdueTasks(activities, now);
    const dueTimes = overdue.map((ref) => ref.dueAt.getTime());
    expect([...dueTimes].sort((a, b) => a - b)).toEqual(dueTimes);
    expect(overdue.every((ref) => ref.dueAt < now && !isActionResolved(ref.action))).toBe(true);
    expect(getAtRiskActivities(activities, now).map((item) => item.activity.id)).toEqual([RESCUE_ACTIVITY_ID]);
  });
});

describe("M0 shell adapter: routes and filters", () => {
  it("builds Today filter links and parses only known filters", () => {
    expect(filterHref("overdue")).toBe("/?show=overdue");
    expect(filterHref("at-risk")).toBe("/?show=at-risk");
    expect(filterHref("waiting")).toBe("/?show=waiting");
    expect(parseExceptionFilter("waiting")).toBe("waiting");
    expect(parseExceptionFilter("everything")).toBeNull();
    expect(parseExceptionFilter(null)).toBeNull();
  });

  it("builds occurrence and recovery routes", () => {
    expect(occurrenceHref("activity-training-rescue")).toBe("/o/activity-training-rescue");
    expect(recoveryHref("activity-training-rescue")).toBe("/o/activity-training-rescue/recovery");
  });
});
