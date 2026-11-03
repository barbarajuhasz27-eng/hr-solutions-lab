import { describe, expect, it } from "vitest";
import { getReadiness, getRecoveryPlan } from "../lib/engine";
import { createSeedActivities } from "../lib/seed";

describe("HR Operations readiness engine", () => {
  const now = new Date("2026-11-03T10:00:00.000Z");
  const activities = createSeedActivities(now);
  const training = activities[0];

  it("seeds a training activity that starts 45 minutes from the reference time", () => {
    const remaining =
      (new Date(training.startsAt).getTime() - now.getTime()) / 60_000;
    expect(remaining).toBe(45);
  });

  it("places the late training activity into recovery mode", () => {
    expect(getReadiness(training, now).status).toBe("recovery");
  });

  it("explains unresolved essential actions", () => {
    const readiness = getReadiness(training, now);
    expect(readiness.unresolvedEssential.map((action) => action.id)).toContain("room-confirmed");
    expect(readiness.unresolvedEssential.map((action) => action.id)).toContain("trainer-confirmed");
  });

  it("puts feasible essential actions into Must do now", () => {
    const plan = getRecoveryPlan(training, now);
    const ids = plan.find((group) => group.id === "must-do-now")?.actions.map((action) => action.id);
    expect(ids).toContain("trainer-confirmed");
    expect(ids).toContain("room-confirmed");
  });

  it("keeps IT setup blocked until room confirmation is complete", () => {
    const plan = getRecoveryPlan(training, now);
    const ids = plan.find((group) => group.id === "blocked")?.actions.map((action) => action.id);
    expect(ids).toContain("it-setup");
  });

  it("keeps the optional attendance follow-up outside the pre-start critical path", () => {
    const plan = getRecoveryPlan(training, now);
    const ids = plan.find((group) => group.id === "follow-up")?.actions.map((action) => action.id);
    expect(ids).toContain("attendance-followup");
  });

  it("does not schedule more essential work than the remaining time allows", () => {
    const shortWindow = {
      ...training,
      startsAt: new Date(now.getTime() + 15 * 60_000).toISOString(),
    };
    const plan = getRecoveryPlan(shortWindow, now);
    const mustDo = plan.find((group) => group.id === "must-do-now")?.actions ?? [];
    const simplify = plan.find((group) => group.id === "can-simplify")?.actions.map((action) => action.id);
    expect(mustDo.reduce((total, action) => total + action.estimatedMinutes, 0)).toBeLessThanOrEqual(15);
    expect(simplify).toContain("room-confirmed");
  });

  it("offers a fallback for the blocked IT setup", () => {
    const itAction = training.actions.find((action) => action.id === "it-setup");
    expect(itAction?.fallback).toContain("laptop");
  });

  it("moves IT setup to Must do now after its room dependency is completed", () => {
    const modified = {
      ...training,
      actions: training.actions.map((action) =>
        action.id === "room-confirmed" ? { ...action, status: "done" as const } : action,
      ),
    };
    const plan = getRecoveryPlan(modified, now);
    const mustDoIds = plan.find((group) => group.id === "must-do-now")?.actions.map((action) => action.id);
    expect(mustDoIds).toContain("it-setup");
  });

  it("marks an activity at risk when an essential prerequisite is still unresolved", () => {
    const upcoming = activities.find((activity) => activity.id === "activity-training-upcoming");
    expect(upcoming).toBeDefined();
    const withOpenRoom = {
      ...upcoming!,
      actions: upcoming!.actions.map((action) =>
        action.id === "room-confirmed" ? { ...action, status: "not-started" as const } : action,
      ),
    };
    expect(getReadiness(withOpenRoom, now).status).toBe("at-risk");
  });

  it("keeps an activity in preparation when its next essential action is several days away", () => {
    const upcoming = activities.find((activity) => activity.id === "activity-training-upcoming");
    expect(upcoming).toBeDefined();
    expect(getReadiness(upcoming!, now).status).toBe("preparing");
  });

  it("moves dependent steps into Can simplify when their prerequisites are complete", () => {
    const modified = {
      ...training,
      actions: training.actions.map((action) =>
        ["trainer-confirmed", "participants-confirmed"].includes(action.id)
          ? { ...action, status: "done" as const }
          : action,
      ),
    };
    const plan = getRecoveryPlan(modified, now);
    const simplifyIds = plan.find((group) => group.id === "can-simplify")?.actions.map((action) => action.id);
    expect(simplifyIds).toContain("participant-reminder");
    expect(simplifyIds).toContain("materials-ready");
  });

  it("treats a completed activity as complete", () => {
    const completed = activities.find((activity) => activity.id === "activity-training-complete");
    expect(completed).toBeDefined();
    expect(getReadiness(completed!, now).status).toBe("completed");
  });
});
