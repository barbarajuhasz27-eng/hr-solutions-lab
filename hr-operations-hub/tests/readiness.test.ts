import { describe, expect, it } from "vitest";
import {
  getActionRisk,
  getPriorityActivity,
  getReadiness,
  getRequiredMinutes,
  holdUpdate,
} from "../lib/engine";
import type { Activity, ActionInstance } from "../lib/model";
import { createActivity, createSeedActivities } from "../lib/seed";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;
const now = new Date("2026-11-03T10:00:00.000Z");

function training(startsInMs: number, id = "training"): Activity {
  return createActivity("training-session", "Training", new Date(now.getTime() + startsInMs), id);
}

function withActions(activity: Activity, update: (action: ActionInstance) => ActionInstance): Activity {
  return { ...activity, actions: activity.actions.map(update) };
}

function markDone(activity: Activity, ids: string[]): Activity {
  return withActions(activity, (action) => (ids.includes(action.id) ? { ...action, status: "done" } : action));
}

describe("readiness — activities planned well in advance", () => {
  it("shows a freshly created activity two weeks out as Preparing, not At risk", () => {
    const readiness = getReadiness(training(14 * DAY), now);
    expect(readiness.status).toBe("preparing");
    expect(readiness.reasons).toEqual([]);
  });

  it("does not treat an open prerequisite as a risk while it is on schedule", () => {
    expect(getActionRisk(training(14 * DAY), "it-setup", now)).toBeNull();
  });
});

describe("readiness — deadlines and remaining time", () => {
  it("needs attention when an essential action is due within 24 hours", () => {
    // Room is due 3 days before the start → due in 12 hours.
    const activity = markDone(training(3.5 * DAY), ["trainer-confirmed", "participants-confirmed"]);
    const readiness = getReadiness(activity, now);
    expect(readiness.status).toBe("needs-attention");
    expect(readiness.reasons.find((reason) => reason.actionId === "room-confirmed")?.kind).toBe("due-soon");
  });

  it("is at risk when an essential deadline has passed", () => {
    // Trainer confirmation is due 7 days before the start → 5 days overdue.
    const readiness = getReadiness(training(2 * DAY), now);
    expect(readiness.status).toBe("at-risk");
    const trainer = readiness.reasons.find((reason) => reason.actionId === "trainer-confirmed");
    expect(trainer?.kind).toBe("deadline-passed");
    expect(trainer?.severity).toBe("risk");
  });

  it("is at risk when an action's remaining work, including prerequisites, exceeds the time to its deadline", () => {
    // IT setup is due 24h before the start → due in 10 minutes, but needs about 12 minutes.
    const activity = markDone(training(DAY + 10 * 60_000), [
      "trainer-confirmed",
      "participants-confirmed",
      "room-confirmed",
    ]);
    expect(getRequiredMinutes(activity, "it-setup")).toBe(12);
    const readiness = getReadiness(activity, now);
    expect(readiness.status).toBe("at-risk");
    expect(readiness.reasons.find((reason) => reason.actionId === "it-setup")?.kind).toBe("insufficient-time");
  });

  it("counts unfinished prerequisites in an action's required time", () => {
    const activity = training(14 * DAY);
    expect(getRequiredMinutes(activity, "it-setup")).toBe(12 + 8);
    expect(getRequiredMinutes(markDone(activity, ["room-confirmed"]), "it-setup")).toBe(12);
  });

  it("is at risk when the total essential work no longer fits before the start", () => {
    const activity: Activity = {
      id: "custom",
      title: "Custom",
      playbookId: "training-session",
      startsAt: new Date(now.getTime() + 2 * HOUR).toISOString(),
      coordinator: "Sophie Lang",
      location: "Room",
      actions: ["a", "b"].map((id) => ({
        id,
        title: `Step ${id}`,
        description: "",
        dueOffsetMinutes: 0,
        ownerRole: "HR",
        criticality: "essential" as const,
        estimatedMinutes: 70,
        dependsOn: [],
        status: "not-started" as const,
        ownerName: "Sophie Lang",
      })),
    };
    const readiness = getReadiness(activity, now);
    expect(readiness.status).toBe("at-risk");
    const overall = readiness.reasons.find((reason) => reason.kind === "insufficient-time" && !reason.actionId);
    expect(overall?.message).toContain("140 min");
  });

  it("is at risk with an explanation once the start has passed with essentials open", () => {
    const readiness = getReadiness(training(-30 * 60_000), now);
    expect(readiness.status).toBe("at-risk");
    expect(readiness.reasons[0].kind).toBe("start-passed");
  });

  it("switches to Recovery inside the last hour", () => {
    expect(getReadiness(training(50 * 60_000), now).status).toBe("recovery");
  });
});

describe("readiness — waiting and blocked holds", () => {
  it("flags a waiting action with plenty of time as Needs attention, not At risk", () => {
    const activity = withActions(training(14 * DAY), (action) =>
      action.id === "room-confirmed"
        ? { ...action, ...holdUpdate({ kind: "waiting", waitingOn: "Facilities", note: "Asked for Room 2.14" }) }
        : action,
    );
    const readiness = getReadiness(activity, now);
    expect(readiness.status).toBe("needs-attention");
    const reason = readiness.reasons.find((item) => item.actionId === "room-confirmed");
    expect(reason?.kind).toBe("waiting");
    expect(reason?.message).toContain("Facilities");
    expect(reason?.message).toContain("Room 2.14");
  });

  it("is at risk when an action is still waiting on someone within 24 hours of its deadline", () => {
    const activity = withActions(markDone(training(3.5 * DAY), ["trainer-confirmed", "participants-confirmed"]), (action) =>
      action.id === "room-confirmed" ? { ...action, ...holdUpdate({ kind: "waiting", waitingOn: "Facilities" }) } : action,
    );
    const readiness = getReadiness(activity, now);
    expect(readiness.status).toBe("at-risk");
    expect(readiness.reasons.find((item) => item.actionId === "room-confirmed")?.kind).toBe("waiting-near-deadline");
  });

  it("is at risk as soon as an essential action is explicitly blocked, and propagates to dependents", () => {
    const activity = withActions(training(14 * DAY), (action) =>
      action.id === "room-confirmed"
        ? { ...action, ...holdUpdate({ kind: "blocked", note: "Room double-booked" }) }
        : action,
    );
    const readiness = getReadiness(activity, now);
    expect(readiness.status).toBe("at-risk");
    expect(readiness.reasons.find((item) => item.actionId === "room-confirmed")?.message).toContain("Room double-booked");
    expect(readiness.reasons.find((item) => item.actionId === "it-setup")?.kind).toBe("dependency-risk");
  });

  it("ignores holds on optional actions for readiness", () => {
    const activity = withActions(training(14 * DAY), (action) =>
      action.id === "attendance-followup" ? { ...action, ...holdUpdate({ kind: "blocked", note: "No form yet" }) } : action,
    );
    expect(getReadiness(activity, now).status).toBe("preparing");
  });
});

describe("priority activity for the Operations Radar", () => {
  it("highlights the activity in Recovery from the seed data", () => {
    const priority = getPriorityActivity(createSeedActivities(now), now);
    expect(priority?.activity.id).toBe("activity-training-rescue");
    expect(priority?.readiness.status).toBe("recovery");
  });

  it("prefers a more urgent status over an earlier start", () => {
    const soonButFine = markDone(training(3.5 * DAY, "soon"), ["trainer-confirmed", "participants-confirmed"]);
    const laterButBlocked = withActions(training(10 * DAY, "later"), (action) =>
      action.id === "trainer-confirmed" ? { ...action, ...holdUpdate({ kind: "blocked", note: "Trainer ill" }) } : action,
    );
    expect(getReadiness(soonButFine, now).status).toBe("needs-attention");
    expect(getPriorityActivity([soonButFine, laterButBlocked], now)?.activity.id).toBe("later");
  });

  it("never highlights an activity that has already started or needs no intervention", () => {
    const started = training(-HOUR, "started");
    const onTrack = training(14 * DAY, "on-track");
    expect(getPriorityActivity([started, onTrack], now)).toBeNull();
  });
});
