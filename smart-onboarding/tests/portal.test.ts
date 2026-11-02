import { describe, expect, it } from "vitest";
import {
  getContacts,
  getJourneyPhases,
  getJourneyPosition,
  getNextCheckpoint,
  getPortalProgress,
  getSchedule,
  getWeekPlan,
  toEmployeeTask,
} from "@/lib/portal";
import { createSeedCases } from "@/lib/seed-data";
import { makeCase, makeTask, TODAY } from "./helpers";

const seed = createSeedCases(TODAY);
const byId = (id: string) => seed.find((c) => c.id === id)!;
const keys = (tasks: { templateKey: string }[]) => tasks.map((t) => t.templateKey);

describe("employee view of a task", () => {
  it("shows a stakeholder's blocked task as Delayed without the internal reason", () => {
    const view = toEmployeeTask(
      makeTask({ key: "equipment", owner: "IT", status: "Blocked", blockedReason: "Supplier back-order" }),
      TODAY,
    );
    expect(view.state).toBe("Delayed");
    expect(JSON.stringify(view)).not.toMatch(/back-order|blocked/i);
  });

  it("shows a stakeholder's mandatory overdue task as Delayed, but not an optional one", () => {
    expect(toEmployeeTask(makeTask({ key: "a", owner: "HR", dueIn: -2 }), TODAY).state).toBe("Delayed");
    expect(toEmployeeTask(makeTask({ key: "b", owner: "HR", dueIn: -2, mandatory: false }), TODAY).state).toBe(
      "Not started",
    );
  });

  it("keeps the real status of the employee's own tasks and flags them past due gently", () => {
    const own = toEmployeeTask(makeTask({ key: "c", owner: "New employee", dueIn: -1, status: "In progress" }), TODAY);
    expect(own).toMatchObject({ isOwn: true, state: "In progress", pastDue: true, ownerLabel: "You" });
    expect(toEmployeeTask(makeTask({ key: "d", owner: "New employee", dueIn: 3 }), TODAY).pastDue).toBe(false);
    expect(toEmployeeTask(makeTask({ key: "e", status: "Completed", dueIn: -3 }), TODAY).state).toBe("Done");
  });

  it("uses employee-facing wording", () => {
    const view = toEmployeeTask(byId("demo-maya-lindqvist").tasks.find((t) => t.templateKey === "equipment")!, TODAY);
    expect(view.title).toBe("IT prepares your laptop and equipment");
    expect(view.ownerLabel).toBe("IT");
    // Tasks without dedicated wording keep their original title.
    expect(toEmployeeTask(makeTask({ key: "custom" }), TODAY).title).toBe("Task custom");
  });
});

describe("where the employee is", () => {
  it("describes the position relative to the start date", () => {
    expect(getJourneyPosition(makeCase(12, []), TODAY)).toEqual({ kind: "before-start", daysUntilStart: 12 });
    expect(getJourneyPosition(makeCase(0, []), TODAY)).toEqual({ kind: "first-day" });
    expect(getJourneyPosition(makeCase(-8, []), TODAY)).toEqual({ kind: "in-progress", daysSinceStart: 8, week: 2 });
    expect(getJourneyPosition(makeCase(-6, []), TODAY)).toMatchObject({ week: 1 });
    expect(getJourneyPosition(makeCase(-90, []), TODAY)).toMatchObject({ kind: "in-progress", week: 13 });
    expect(getJourneyPosition(makeCase(-95, []), TODAY)).toEqual({ kind: "beyond-90", daysSinceStart: 95 });
  });

  it("finds the next Day 1 / 30 / 60 / 90 checkpoint by date", () => {
    expect(getNextCheckpoint(makeCase(12, []), TODAY)).toMatchObject({ label: "Day 1", daysAway: 12 });
    expect(getNextCheckpoint(makeCase(0, []), TODAY)).toMatchObject({ label: "Day 1", daysAway: 0 });
    expect(getNextCheckpoint(makeCase(-8, []), TODAY)).toMatchObject({ label: "Day 30", daysAway: 22 });
    expect(getNextCheckpoint(makeCase(-60, []), TODAY)).toMatchObject({ label: "Day 60", daysAway: 0 });
    expect(getNextCheckpoint(makeCase(-91, []), TODAY)).toBeNull();
  });
});

describe("journey phases", () => {
  it("marks the current phase by date and finished phases by mandatory steps", () => {
    const phases = getJourneyPhases(byId("demo-daniel-okafor"), TODAY);
    expect(phases.map((p) => p.label)).toEqual([
      "Before you start",
      "Your first day",
      "Your first month",
      "Building momentum",
      "Your 90-day review",
    ]);
    expect(phases.map((p) => p.state)).toEqual(["done", "wrapping-up", "current", "upcoming", "upcoming"]);
    // The optional remote-working guide is still open, but does not hold the phase open.
    expect(phases[0]).toMatchObject({ done: 9, total: 10 });
  });

  it("puts a future starter in the first phase and a finished one in no phase", () => {
    expect(getJourneyPhases(byId("demo-noah-adeyemi"), TODAY).map((p) => p.state)).toEqual([
      "current",
      "upcoming",
      "upcoming",
      "upcoming",
      "upcoming",
    ]);
    expect(getJourneyPhases(byId("demo-lena-fischer"), TODAY).every((p) => p.state === "done")).toBe(true);
  });

  it("includes every task of the case exactly once", () => {
    for (const c of seed) {
      const all = getJourneyPhases(c, TODAY).flatMap((p) => p.tasks.map((t) => t.id));
      expect(all.sort()).toEqual(c.tasks.map((t) => t.id).sort());
    }
  });
});

describe("this week", () => {
  it("separates the employee's own steps from what the team is preparing", () => {
    const plan = getWeekPlan(byId("demo-maya-lindqvist"), TODAY);
    expect(plan).toMatchObject({ from: TODAY, to: "2026-11-09" });
    expect(keys(plan.yourTasks)).toEqual(["new-hire-forms"]);
    expect(keys(plan.teamTasks)).toEqual(["payroll-setup", "account-provisioning", "equipment"]);
    expect(plan.teamTasks.find((t) => t.templateKey === "equipment")!.state).toBe("Delayed");
    expect(keys(plan.recentlyDone)).toEqual(["employment-docs"]);
    expect(plan.comingUp).toEqual([]);
  });

  it("includes mandatory past-due team steps but not optional ones", () => {
    const plan = getWeekPlan(byId("demo-daniel-okafor"), TODAY);
    expect(keys(plan.yourTasks)).toEqual([]);
    expect(keys(plan.teamTasks)).toEqual(["confirm-access"]);
    expect(keys(plan.recentlyDone)).toEqual(["remote-setup-call"]);
  });

  it("includes the employee's own past-due steps", () => {
    const own = getWeekPlan(byId("demo-sofia-marin"), TODAY).yourTasks;
    expect(own.map((t) => [t.templateKey, t.pastDue])).toEqual([["experience-survey", true]]);
  });

  it("shows the next steps when nothing is due this week", () => {
    const plan = getWeekPlan(byId("demo-noah-adeyemi"), TODAY);
    expect(plan.yourTasks).toEqual([]);
    expect(plan.teamTasks).toEqual([]);
    expect(keys(plan.comingUp)).toEqual(["employment-docs", "new-hire-forms", "payroll-setup"]);
  });
});

describe("schedule, people and progress", () => {
  it("lists the first day and planned sessions in date order", () => {
    const schedule = getSchedule(byId("demo-maya-lindqvist"), TODAY);
    expect(schedule.upcoming.map((e) => e.title).slice(0, 4)).toEqual([
      "Your first day",
      "Welcome & company orientation",
      "Meet your team",
      "Office walkthrough",
    ]);
    expect(schedule.upcoming[1].with).toBe("Clara Mendes");
    expect(schedule.past).toEqual([]);
  });

  it("moves completed and past sessions out of the upcoming list", () => {
    const schedule = getSchedule(byId("demo-daniel-okafor"), TODAY);
    expect(schedule.upcoming.map((e) => e.title)).toEqual([
      "First-month conversation",
      "Onboarding feedback conversation",
      "Progress and support conversation",
      "90-day review",
    ]);
    expect(schedule.past.map((e) => e.title)).toContain("Your first day");
    expect(getSchedule(byId("demo-lena-fischer"), TODAY).upcoming).toEqual([]);
  });

  it("lists manager, HR partner and buddy, with the buddy introduction status", () => {
    const maya = getContacts(byId("demo-maya-lindqvist"));
    expect(maya.map((c) => [c.kind, c.name, c.introduced])).toEqual([
      ["manager", "Jonas Berg", true],
      ["hr", "Clara Mendes", true],
      ["buddy", "Felix Andersen", false],
    ]);
    expect(getContacts(byId("demo-daniel-okafor"))[2].introduced).toBe(true);
  });

  it("counts all steps and the employee's own steps", () => {
    expect(getPortalProgress(byId("demo-daniel-okafor"))).toEqual({
      overallPercent: 63,
      done: 12,
      total: 19,
      ownDone: 1,
      ownTotal: 2,
    });
  });
});
