import { describe, expect, it } from "vitest";
import {
  findDependencyCycles,
  getBlockedDownstream,
  getDependencyStatus,
  getDependents,
  getDownstream,
  getPrerequisites,
  getUpstreamMandatory,
  isEffectivelyComplete,
} from "@/lib/dependencies";
import { getMilestones } from "@/lib/metrics";
import { buildWorkflowTemplate, TASK_LIBRARY } from "@/lib/workflow-templates";
import type { WorkflowContext } from "@/types/onboarding";
import { makeCase, TODAY } from "./helpers";

const ALL_CONTEXTS: WorkflowContext[] = (["Office", "Remote"] as const).flatMap((workArrangement) =>
  [false, true].flatMap((peopleManager) =>
    [false, true].map((internationalHire) => ({ workArrangement, peopleManager, internationalHire })),
  ),
);

const chain = makeCase(20, [
  { key: "a", dueIn: 5 },
  { key: "b", dueIn: 8, dependsOn: ["a"] },
  { key: "c", dueIn: 12, dependsOn: ["b"] },
  { key: "opt", dueIn: 4, mandatory: false },
  { key: "d", dueIn: 14, dependsOn: ["opt", "c"] },
]);
const task = (key: string) => chain.tasks.find((t) => t.templateKey === key)!;

describe("dependency resolution", () => {
  it("finds direct prerequisites and dependents", () => {
    expect(getPrerequisites(chain.tasks, task("d")).map((t) => t.templateKey)).toEqual(["opt", "c"]);
    expect(getDependents(chain.tasks, task("a")).map((t) => t.templateKey)).toEqual(["b"]);
  });

  it("walks mandatory prerequisites transitively, skipping optional ones", () => {
    expect(getUpstreamMandatory(chain.tasks, task("d")).map((t) => t.templateKey)).toEqual(["c", "b", "a"]);
  });

  it("walks downstream tasks transitively", () => {
    expect(getDownstream(chain.tasks, task("a")).map((t) => t.templateKey)).toEqual(["b", "c", "d"]);
  });

  it("treats a completed task as incomplete while a mandatory prerequisite is open", () => {
    const c = makeCase(20, [
      { key: "a", dueIn: 5 },
      { key: "b", dueIn: 8, status: "Completed", dependsOn: ["a"] },
      { key: "c", dueIn: 9, status: "Completed", dependsOn: ["b"] },
    ]);
    const [, b, cTask] = c.tasks;
    expect(isEffectivelyComplete(c.tasks, b)).toBe(false);
    expect(isEffectivelyComplete(c.tasks, cTask)).toBe(false); // transitive
  });

  it("does not let an optional prerequisite hold up a task", () => {
    const c = makeCase(20, [
      { key: "opt", mandatory: false, dueIn: 1 },
      { key: "x", dueIn: 5, status: "Completed", dependsOn: ["opt"] },
    ]);
    expect(isEffectivelyComplete(c.tasks, c.tasks[1])).toBe(true);
    expect(getDependencyStatus(c, c.tasks[1], TODAY).state).toBe("resolved");
  });

  it("derives the dependency state of a task", () => {
    expect(getDependencyStatus(chain, task("a"), TODAY).state).toBe("none");
    expect(getDependencyStatus(chain, task("b"), TODAY).state).toBe("waiting");

    const resolved = makeCase(20, [
      { key: "a", status: "Completed", dueIn: 1 },
      { key: "b", dueIn: 8, dependsOn: ["a"] },
    ]);
    expect(getDependencyStatus(resolved, resolved.tasks[1], TODAY).state).toBe("resolved");

    const blocked = makeCase(20, [
      { key: "a", status: "Blocked", dueIn: 5 },
      { key: "b", dueIn: 8, dependsOn: ["a"] },
      { key: "c", dueIn: 9, dependsOn: ["b"] },
    ]);
    const status = getDependencyStatus(blocked, blocked.tasks[2], TODAY);
    expect(status.state).toBe("blocked-upstream");
    expect(status.blockers.map((t) => t.templateKey)).toEqual(["a"]);

    const overdue = makeCase(20, [
      { key: "a", dueIn: -1 },
      { key: "b", dueIn: 8, dependsOn: ["a"] },
    ]);
    expect(getDependencyStatus(overdue, overdue.tasks[1], TODAY).state).toBe("blocked-upstream");
  });
});

describe("blocked downstream tasks", () => {
  it("surfaces every open task held up by a blocked or overdue mandatory prerequisite", () => {
    const c = makeCase(20, [
      { key: "laptop", status: "Blocked", dueIn: 5 },
      { key: "access", dueIn: 8, dependsOn: ["laptop"] },
      { key: "check", dueIn: 9, dependsOn: ["access"] },
      { key: "done", dueIn: 9, status: "Completed", dependsOn: ["laptop"] },
      { key: "late", dueIn: -3 },
      { key: "after-late", dueIn: 6, dependsOn: ["late"] },
      { key: "unrelated", dueIn: 6 },
    ]);
    const items = getBlockedDownstream(c, TODAY).map((i) => [i.task.templateKey, i.blocker.templateKey, i.cause]);
    expect(items).toEqual([
      ["access", "laptop", "blocked"],
      ["check", "laptop", "blocked"],
      ["after-late", "late", "overdue"],
    ]);
  });
});

describe("workflow template dependencies", () => {
  it("has no dependency cycles", () => {
    expect(findDependencyCycles(TASK_LIBRARY)).toEqual([]);
  });

  it("detects a cycle when one exists", () => {
    expect(
      findDependencyCycles([
        { key: "x", dependsOn: ["y"] },
        { key: "y", dependsOn: ["z"] },
        { key: "z", dependsOn: ["x"] },
        { key: "free", dependsOn: [] },
      ]).sort(),
    ).toEqual(["x", "y", "z"]);
  });

  it.each(ALL_CONTEXTS)("only references tasks present in the workflow (%o)", (context) => {
    const template = buildWorkflowTemplate(context);
    const keys = new Set(template.map((t) => t.key));
    for (const t of template) {
      for (const dep of t.dependsOn ?? []) {
        expect(keys.has(dep)).toBe(true);
        // A prerequisite is never scheduled after the task that depends on it.
        expect(template.find((p) => p.key === dep)!.offsetDays).toBeLessThanOrEqual(t.offsetDays);
      }
    }
  });

  it("requires IT equipment and system access before the Day 1 milestone", () => {
    const office = buildWorkflowTemplate(ALL_CONTEXTS[0]);
    expect(office.find((t) => t.key === "system-access")?.dependsOn).toEqual(["account-provisioning"]);
    expect(office.find((t) => t.key === "confirm-access")?.dependsOn).toEqual(["equipment", "system-access"]);
    expect(office.find((t) => t.key === "equipment")).toMatchObject({ mandatory: true, stage: "Pre-boarding" });
  });
});

describe("milestone readiness", () => {
  it("reaches a milestone on mandatory tasks only", () => {
    const c = makeCase(20, [
      { key: "a", status: "Completed", dueIn: 5 },
      { key: "opt", mandatory: false, dueIn: 6 },
    ]);
    const day1 = getMilestones(c, TODAY)[0];
    expect(day1).toMatchObject({ status: "Completed", completedTasks: 1, totalTasks: 1, optionalTasks: 1 });
  });

  it("does not reach a milestone while a completed task's prerequisite is open", () => {
    const c = makeCase(20, [
      { key: "a", dueIn: 5 },
      { key: "b", stage: "Day 1", status: "Completed", dueIn: 20, dependsOn: ["a"] },
    ]);
    const day1 = getMilestones(c, TODAY)[0];
    expect(day1.status).not.toBe("Completed");
    expect(day1.openTasks.map((t) => t.templateKey).sort()).toEqual(["a", "b"]);
  });
});
