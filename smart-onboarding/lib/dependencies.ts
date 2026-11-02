import { diffInDays } from "@/lib/dates";
import type { ISODate, OnboardingCase, OnboardingTask, TaskTemplate } from "@/types/onboarding";

/**
 * Task dependency resolution.
 *
 * Dependencies are stored as template keys within the same case. Only *mandatory*
 * prerequisites gate readiness; an optional prerequisite is shown for context but never
 * holds up a downstream task.
 */

type TaskLike = Pick<OnboardingTask, "templateKey" | "dependsOn" | "status" | "mandatory" | "dueDate">;

function indexByKey<T extends TaskLike>(tasks: readonly T[]): Map<string, T> {
  return new Map(tasks.map((t) => [t.templateKey, t]));
}

function isOpenAndOverdue(task: TaskLike, today: ISODate): boolean {
  return task.status !== "Completed" && diffInDays(today, task.dueDate) < 0;
}

/** Direct prerequisites of a task (mandatory and optional). */
export function getPrerequisites<T extends TaskLike>(tasks: readonly T[], task: TaskLike): T[] {
  const byKey = indexByKey(tasks);
  return task.dependsOn.map((key) => byKey.get(key)).filter((t): t is T => t !== undefined);
}

/** Tasks that directly depend on the given task. */
export function getDependents<T extends TaskLike>(tasks: readonly T[], task: TaskLike): T[] {
  return tasks.filter((t) => t.dependsOn.includes(task.templateKey));
}

/** All mandatory prerequisites, transitively (cycle-safe). */
export function getUpstreamMandatory<T extends TaskLike>(tasks: readonly T[], task: TaskLike): T[] {
  const byKey = indexByKey(tasks);
  const seen = new Set<string>();
  const result: T[] = [];
  const visit = (current: TaskLike) => {
    for (const key of current.dependsOn) {
      const prerequisite = byKey.get(key);
      if (!prerequisite || !prerequisite.mandatory || seen.has(key)) continue;
      seen.add(key);
      result.push(prerequisite);
      visit(prerequisite);
    }
  };
  visit(task);
  return result;
}

/** All tasks that depend on the given task, transitively (cycle-safe). */
export function getDownstream<T extends TaskLike>(tasks: readonly T[], task: TaskLike): T[] {
  const seen = new Set<string>([task.templateKey]);
  const result: T[] = [];
  const queue: TaskLike[] = [task];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const dependent of getDependents(tasks, current)) {
      if (seen.has(dependent.templateKey)) continue;
      seen.add(dependent.templateKey);
      result.push(dependent);
      queue.push(dependent);
    }
  }
  return result;
}

/**
 * A task counts as complete for readiness only when it is marked Completed *and*
 * every mandatory prerequisite (transitively) is also completed.
 */
export function isEffectivelyComplete(tasks: readonly TaskLike[], task: TaskLike): boolean {
  if (task.status !== "Completed") return false;
  return getUpstreamMandatory(tasks, task).every((t) => t.status === "Completed");
}

/** Direct mandatory prerequisites that are not yet effectively complete. */
export function getUnresolvedPrerequisites<T extends TaskLike>(tasks: readonly T[], task: TaskLike): T[] {
  return getPrerequisites(tasks, task).filter((p) => p.mandatory && !isEffectivelyComplete(tasks, p));
}

export type DependencyState = "none" | "resolved" | "waiting" | "blocked-upstream";

export type DependencyStatus = {
  state: DependencyState;
  /** Unresolved direct mandatory prerequisites. */
  waitingOn: OnboardingTask[];
  /** The upstream mandatory task(s) that are blocked or overdue. */
  blockers: OnboardingTask[];
};

export function getDependencyStatus(
  onboarding: Pick<OnboardingCase, "tasks">,
  task: OnboardingTask,
  today: ISODate,
): DependencyStatus {
  const { tasks } = onboarding;
  if (task.dependsOn.length === 0) return { state: "none", waitingOn: [], blockers: [] };
  const waitingOn = getUnresolvedPrerequisites(tasks, task);
  const blockers = getUpstreamMandatory(tasks, task).filter(
    (t) => t.status === "Blocked" || isOpenAndOverdue(t, today),
  );
  if (blockers.length > 0) return { state: "blocked-upstream", waitingOn, blockers };
  if (waitingOn.length > 0) return { state: "waiting", waitingOn, blockers };
  return { state: "resolved", waitingOn, blockers };
}

export type BlockedDownstreamItem = {
  task: OnboardingTask;
  blocker: OnboardingTask;
  cause: "blocked" | "overdue";
};

/**
 * Open tasks held up by an upstream mandatory task that is Blocked or overdue.
 * Each downstream task is reported once, against its nearest problematic prerequisite.
 */
export function getBlockedDownstream(
  onboarding: Pick<OnboardingCase, "tasks">,
  today: ISODate,
): BlockedDownstreamItem[] {
  const items: BlockedDownstreamItem[] = [];
  for (const task of onboarding.tasks) {
    if (task.status === "Completed") continue;
    const blocker = getUpstreamMandatory(onboarding.tasks, task).find(
      (t) => t.status === "Blocked" || isOpenAndOverdue(t, today),
    );
    if (blocker) {
      items.push({ task, blocker, cause: blocker.status === "Blocked" ? "blocked" : "overdue" });
    }
  }
  return items;
}

/** Returns the template keys involved in any dependency cycle (empty when acyclic). */
export function findDependencyCycles(templates: readonly Pick<TaskTemplate, "key" | "dependsOn">[]): string[] {
  const byKey = new Map(templates.map((t) => [t.key, t]));
  const state = new Map<string, "visiting" | "done">();
  const inCycle = new Set<string>();
  const visit = (key: string, path: string[]) => {
    if (state.get(key) === "done") return;
    if (state.get(key) === "visiting") {
      path.slice(path.indexOf(key)).forEach((k) => inCycle.add(k));
      return;
    }
    state.set(key, "visiting");
    for (const dep of byKey.get(key)?.dependsOn ?? []) {
      if (byKey.has(dep)) visit(dep, [...path, key]);
    }
    state.set(key, "done");
  };
  for (const t of templates) visit(t.key, []);
  return [...inCycle];
}
