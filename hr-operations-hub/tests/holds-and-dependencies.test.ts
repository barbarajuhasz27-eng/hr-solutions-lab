import { describe, expect, it } from "vitest";
import {
  applyActionUpdate,
  completeUpdate,
  getDependencyInfo,
  getRecoveryPlan,
  holdUpdate,
  reopenUpdate,
  validateHold,
} from "../lib/engine";
import type { Activity, ActionUpdate, RecoveryGroup } from "../lib/model";
import { createSeedActivities, RESCUE_ACTIVITY_ID } from "../lib/seed";

const now = new Date("2026-11-03T10:00:00.000Z");

function rescue(): Activity {
  return createSeedActivities(now).find((activity) => activity.id === RESCUE_ACTIVITY_ID)!;
}

function update(activity: Activity, actionId: string, change: ActionUpdate): Activity {
  return applyActionUpdate([activity], activity.id, actionId, change)[0];
}

function group(plan: RecoveryGroup[], id: RecoveryGroup["id"]) {
  return plan.find((item) => item.id === id)!;
}

describe("validating waiting / blocked holds", () => {
  it("requires a person or team when waiting", () => {
    expect(validateHold({ kind: "waiting", waitingOn: "  " })).toMatch(/person or team/);
    expect(validateHold({ kind: "waiting", waitingOn: "Facilities" })).toBeNull();
  });

  it("requires a short explanation when blocked", () => {
    expect(validateHold({ kind: "blocked", note: "" })).toMatch(/blocking/);
    expect(validateHold({ kind: "blocked", note: "Room double-booked" })).toBeNull();
  });

  it("rejects overly long input", () => {
    expect(validateHold({ kind: "blocked", note: "x".repeat(161) })).toMatch(/160/);
    expect(validateHold({ kind: "waiting", waitingOn: "x".repeat(61) })).toMatch(/60/);
  });

  it("stores trimmed values and only keeps 'waiting on' for waiting holds", () => {
    expect(holdUpdate({ kind: "waiting", waitingOn: " IT ", note: " Ticket raised " })).toMatchObject({
      status: "waiting",
      waitingOn: "IT",
      statusNote: "Ticket raised",
    });
    expect(holdUpdate({ kind: "blocked", waitingOn: "IT", note: "No laptop" }).waitingOn).toBeUndefined();
  });

  it("clears the hold when an action is completed or released", () => {
    const held = update(rescue(), "room-confirmed", holdUpdate({ kind: "waiting", waitingOn: "Facilities" }));
    const done = update(held, "room-confirmed", completeUpdate("Done"));
    expect(done.actions.find((action) => action.id === "room-confirmed")).toMatchObject({ status: "done", waitingOn: undefined });
    const released = update(held, "room-confirmed", reopenUpdate());
    expect(released.actions.find((action) => action.id === "room-confirmed")).toMatchObject({ status: "not-started", waitingOn: undefined });
  });
});

describe("Rapid Recovery with waiting / blocked holds", () => {
  it("moves a waiting action into 'Blocked / needs someone else' with who and why", () => {
    const activity = update(rescue(), "room-confirmed", holdUpdate({ kind: "waiting", waitingOn: "Facilities", note: "Asked for Room 2.14" }));
    const plan = getRecoveryPlan(activity, now);
    const blocked = group(plan, "blocked");
    expect(blocked.actions.map((action) => action.id)).toContain("room-confirmed");
    expect(blocked.explanations["room-confirmed"]).toBe("Waiting on Facilities — Asked for Room 2.14.");
    expect(group(plan, "must-do-now").actions.map((action) => action.id)).not.toContain("room-confirmed");
  });

  it("keeps a blocked essential action in the blocked group with its note and fallback available", () => {
    const activity = update(rescue(), "trainer-confirmed", holdUpdate({ kind: "blocked", note: "Trainer called in sick" }));
    const blocked = group(getRecoveryPlan(activity, now), "blocked");
    const trainer = blocked.actions.find((action) => action.id === "trainer-confirmed");
    expect(trainer?.fallback).toBeTruthy();
    expect(blocked.explanations["trainer-confirmed"]).toContain("Trainer called in sick");
  });

  it("does not spend the remaining time budget on held actions", () => {
    // 15 minutes left: normally trainer (3) + participants (5) fit and the room (8) does not.
    const shortWindow = { ...rescue(), startsAt: new Date(now.getTime() + 15 * 60_000).toISOString() };
    const activity = update(shortWindow, "participants-confirmed", holdUpdate({ kind: "waiting", waitingOn: "Team leads" }));
    const mustDo = group(getRecoveryPlan(activity, now), "must-do-now").actions.map((action) => action.id);
    expect(mustDo).toEqual(["trainer-confirmed", "room-confirmed"]);
  });

  it("returns a released action to the normal recovery order", () => {
    const held = update(rescue(), "room-confirmed", holdUpdate({ kind: "blocked", note: "No room" }));
    const released = update(held, "room-confirmed", reopenUpdate());
    expect(group(getRecoveryPlan(released, now), "must-do-now").actions.map((action) => action.id)).toContain("room-confirmed");
  });

  it("explains which prerequisite a dependent action is waiting for", () => {
    const blocked = group(getRecoveryPlan(rescue(), now), "blocked");
    expect(blocked.explanations["it-setup"]).toBe("Can start once “Confirm room or virtual meeting” is resolved.");
  });

  it("explains why an essential action was moved to Can simplify", () => {
    const shortWindow = { ...rescue(), startsAt: new Date(now.getTime() + 15 * 60_000).toISOString() };
    const simplify = group(getRecoveryPlan(shortWindow, now), "can-simplify");
    expect(simplify.explanations["room-confirmed"]).toContain("only 7 min remain");
  });
});

describe("dependency information for the Activity Workspace", () => {
  it("lists open prerequisites and the steps an action unlocks", () => {
    const activity = rescue();
    const itSetup = getDependencyInfo(activity, "it-setup");
    expect(itSetup.openPrerequisites.map((action) => action.id)).toEqual(["room-confirmed"]);
    const room = getDependencyInfo(activity, "room-confirmed");
    expect(room.prerequisites).toEqual([]);
    expect(room.dependents.map((action) => action.id)).toEqual(["it-setup"]);
  });

  it("marks prerequisites as resolved once they are done", () => {
    const activity = update(rescue(), "room-confirmed", completeUpdate("Done"));
    const itSetup = getDependencyInfo(activity, "it-setup");
    expect(itSetup.openPrerequisites).toEqual([]);
    expect(itSetup.prerequisites[0]).toMatchObject({ resolved: true });
  });
});
