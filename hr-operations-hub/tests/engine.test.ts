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
