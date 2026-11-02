import { beforeEach, describe, expect, it } from "vitest";
import { areaForPath, areaForRole, canEditTask, canSetTaskStatus, canViewCase, type Viewer } from "@/lib/access";
import { onboardingStore, updateTaskStatusAs } from "@/lib/onboarding-store";
import { createSeedCases } from "@/lib/seed-data";
import { TASK_STATUSES } from "@/types/onboarding";
import { TODAY } from "./helpers";

const seed = createSeedCases(TODAY);
const daniel = seed.find((c) => c.id === "demo-daniel-okafor")!;
const maya = seed.find((c) => c.id === "demo-maya-lindqvist")!;
const danielOwn = daniel.tasks.find((t) => t.templateKey === "experience-survey")!; // owner: New employee
const danielIt = daniel.tasks.find((t) => t.templateKey === "confirm-access")!; // owner: IT
const mayaOwn = maya.tasks.find((t) => t.templateKey === "new-hire-forms")!;

const HR: Viewer = { role: "hr" };
const DANIEL: Viewer = { role: "new-hire", caseId: daniel.id };

describe("task permissions in the simulated previews", () => {
  it("lets HR update every task in every case", () => {
    for (const task of [danielOwn, danielIt, mayaOwn]) expect(canEditTask(HR, daniel, task)).toBe(true);
    for (const status of TASK_STATUSES) expect(canSetTaskStatus(HR, daniel, danielIt, status)).toBe(true);
  });

  it("lets a new hire update only their own tasks in their own case", () => {
    expect(canEditTask(DANIEL, daniel, danielOwn)).toBe(true);
    expect(canEditTask(DANIEL, daniel, danielIt)).toBe(false);
    expect(canEditTask(DANIEL, maya, mayaOwn)).toBe(false);
  });

  it("does not let a new hire mark their own task as Blocked", () => {
    expect(canSetTaskStatus(DANIEL, daniel, danielOwn, "Completed")).toBe(true);
    expect(canSetTaskStatus(DANIEL, daniel, danielOwn, "In progress")).toBe(true);
    expect(canSetTaskStatus(DANIEL, daniel, danielOwn, "Not started")).toBe(true);
    expect(canSetTaskStatus(DANIEL, daniel, danielOwn, "Blocked")).toBe(false);
  });

  it("limits a new hire to viewing their own case", () => {
    expect(canViewCase(DANIEL, daniel)).toBe(true);
    expect(canViewCase(DANIEL, maya)).toBe(false);
    expect(canViewCase(HR, maya)).toBe(true);
  });
});

describe("updateTaskStatusAs", () => {
  it("applies permitted changes", () => {
    const next = updateTaskStatusAs(DANIEL, seed, daniel.id, danielOwn.id, "Completed", TODAY);
    const task = next.find((c) => c.id === daniel.id)!.tasks.find((t) => t.id === danielOwn.id)!;
    expect(task.status).toBe("Completed");
    expect(task.completedAt).toBe(TODAY);
  });

  it("ignores changes the viewer is not allowed to make", () => {
    for (const [caseId, taskId, status] of [
      [daniel.id, danielIt.id, "Completed"],
      [daniel.id, danielOwn.id, "Blocked"],
      [maya.id, mayaOwn.id, "Completed"],
      [daniel.id, "missing-task", "Completed"],
    ] as const) {
      const next = updateTaskStatusAs(DANIEL, seed, caseId, taskId, status, TODAY);
      expect(next).toEqual(seed);
      next.forEach((c, i) => expect(c).toBe(seed[i]));
    }
  });
});

describe("store action for the portal", () => {
  beforeEach(() => {
    window.localStorage.clear();
    onboardingStore._resetForTests();
  });

  it("persists permitted changes and ignores others", () => {
    const store = onboardingStore.getSnapshot();
    const own = store.find((c) => c.id === daniel.id)!.tasks.find((t) => t.templateKey === "experience-survey")!;
    const itTask = store.find((c) => c.id === daniel.id)!.tasks.find((t) => t.templateKey === "confirm-access")!;

    onboardingStore.setTaskStatusAs(DANIEL, daniel.id, itTask.id, "Completed");
    expect(onboardingStore.getSnapshot()).toBe(store);

    onboardingStore.setTaskStatusAs(DANIEL, daniel.id, own.id, "Completed");
    onboardingStore._resetForTests();
    const reloaded = onboardingStore.getSnapshot().find((c) => c.id === daniel.id)!;
    expect(reloaded.tasks.find((t) => t.id === own.id)!.status).toBe("Completed");
    expect(reloaded.tasks.find((t) => t.id === itTask.id)!.status).toBe("In progress");
  });
});

describe("workspace areas", () => {
  it("maps paths to the portal or the HR workspace", () => {
    expect(areaForPath("/")).toBeNull();
    expect(areaForPath("/me/journey")).toBe("portal");
    expect(areaForPath("/me")).toBe("portal");
    expect(areaForPath("/readiness")).toBe("hr");
    expect(areaForPath("/insights")).toBe("hr");
    expect(areaForPath("/tasks")).toBe("hr");
    expect(areaForPath("/onboarding/new")).toBe("hr");
    expect(areaForPath("/onboarding/demo-maya-lindqvist")).toBe("hr");
    expect(areaForPath("/meetings")).toBeNull();
    expect(areaForPath("/unknown")).toBeNull();
    expect(areaForRole("hr")).toBe("hr");
    expect(areaForRole("new-hire")).toBe("portal");
  });
});
