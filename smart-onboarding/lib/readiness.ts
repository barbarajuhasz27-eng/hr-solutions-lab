import { diffInDays, formatShortDate } from "@/lib/dates";
import {
  getBlockedDownstream,
  getDownstream,
  getUnresolvedPrerequisites,
  isEffectivelyComplete,
} from "@/lib/dependencies";
import {
  DUE_SOON_WINDOW_DAYS,
  getMilestones,
  isTaskDueSoon,
  isTaskOverdue,
  MILESTONES,
  pickNextMilestone,
  type Milestone,
} from "@/lib/metrics";
import type { ISODate, OnboardingCase, OnboardingTask } from "@/types/onboarding";

/**
 * Onboarding Readiness Engine.
 *
 * Readiness is rule-based, not a weighted score. Every case is evaluated against a fixed,
 * ordered set of rules. The first group of rules that fails determines the status, and
 * every failing rule produces a plain-language reason that references the exact tasks.
 *
 *  NOT READY: a mandatory task is overdue, a mandatory task is blocked, or a milestone
 *             is due (today or earlier) while its mandatory tasks are still open.
 *  AT RISK:   no critical issue, but a mandatory task is due within 7 days, a task due soon
 *             or in progress is still waiting on an unresolved mandatory prerequisite, or a
 *             task was marked completed before its mandatory prerequisite.
 *  READY:     no issue above, and every mandatory task required for the next milestone
 *             (including mandatory prerequisites) is completed.
 *  ON TRACK:  no issue above, but required work for the next milestone is still open and
 *             nothing is due within 7 days. This neutral state exists so that a case is not
 *             labelled Ready while work remains, nor flagged as a risk when nothing is wrong.
 */

export const READINESS_STATUSES = ["Not ready", "At risk", "On track", "Ready"] as const;
export type ReadinessStatus = (typeof READINESS_STATUSES)[number];

export type ReasonKind =
  | "overdue"
  | "blocked"
  | "milestone-due"
  | "due-soon"
  | "waiting-on-prerequisite"
  | "completed-before-prerequisite";

export type ReadinessReason = {
  kind: ReasonKind;
  severity: "critical" | "warning";
  message: string;
  taskId?: string;
  /** Other tasks involved, e.g. the prerequisite or the downstream tasks held up. */
  relatedTaskIds: string[];
};

export type RuleId =
  | "no-overdue"
  | "no-blocked"
  | "no-due-milestone-open"
  | "no-due-soon"
  | "prerequisites-resolved"
  | "completion-order"
  | "milestone-complete";

export type ReadinessRule = {
  id: RuleId;
  label: string;
  /** The status this rule produces when it fails. */
  failsTo: Exclude<ReadinessStatus, "Ready">;
  passed: boolean;
};

export type ReadinessAssessment = {
  status: ReadinessStatus;
  /** The milestone readiness is assessed against, or null when every milestone is reached. */
  milestone: Milestone | null;
  headline: string;
  reasons: ReadinessReason[];
  rules: ReadinessRule[];
  /** Mandatory tasks required for the target milestone (including mandatory prerequisites). */
  requiredTasks: OnboardingTask[];
  requiredCompleted: number;
};

function quote(task: OnboardingTask) {
  return `“${task.title}” (${task.owner})`;
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * The milestone a case is assessed against: the next milestone dated today or later.
 * Earlier milestones that were missed are covered by the "milestone due" rule.
 * After Day 90 has passed: the first unreached milestone, or null when all are reached.
 */
export function getTargetMilestone(milestones: Milestone[], today: ISODate): Milestone | null {
  return pickNextMilestone(milestones, today);
}

/** Mandatory tasks in the milestone's stages plus their mandatory prerequisites. */
function requiredTasksFor(onboarding: OnboardingCase, milestone: Milestone | null): OnboardingTask[] {
  if (!milestone) return [];
  const stages = MILESTONES.find((m) => m.key === milestone.key)?.stages ?? [];
  const direct = onboarding.tasks.filter((t) => t.mandatory && stages.includes(t.stage));
  const keys = new Set(direct.map((t) => t.templateKey));
  const queue = [...direct];
  while (queue.length > 0) {
    const task = queue.shift()!;
    for (const key of task.dependsOn) {
      const prerequisite = onboarding.tasks.find((t) => t.templateKey === key);
      if (prerequisite?.mandatory && !keys.has(key)) {
        keys.add(key);
        queue.push(prerequisite);
      }
    }
  }
  return onboarding.tasks.filter((t) => keys.has(t.templateKey));
}

export function assessReadiness(onboarding: OnboardingCase, today: ISODate): ReadinessAssessment {
  const { tasks } = onboarding;
  const milestones = getMilestones(onboarding, today);
  const target = getTargetMilestone(milestones, today);
  const required = requiredTasksFor(onboarding, target);
  const openRequired = required.filter((t) => !isEffectivelyComplete(tasks, t));
  const openMandatory = tasks.filter((t) => t.mandatory && !isEffectivelyComplete(tasks, t));
  const reasons: ReadinessReason[] = [];

  // --- Critical rules (NOT READY) -------------------------------------------------------
  const overdue = openMandatory.filter((t) => isTaskOverdue(t, today));
  for (const task of overdue) {
    const days = Math.abs(diffInDays(today, task.dueDate));
    const downstream = getDownstream(tasks, task).filter((d) => d.status !== "Completed");
    reasons.push({
      kind: "overdue",
      severity: "critical",
      taskId: task.id,
      relatedTaskIds: downstream.map((d) => d.id),
      message:
        `Mandatory task ${quote(task)} is ${plural(days, "day")} overdue (due ${formatShortDate(task.dueDate)}).` +
        (downstream.length > 0 ? ` It holds up ${plural(downstream.length, "downstream task")}.` : ""),
    });
  }

  const blocked = openMandatory.filter((t) => t.status === "Blocked");
  for (const task of blocked) {
    const downstream = getDownstream(tasks, task).filter((d) => d.status !== "Completed");
    reasons.push({
      kind: "blocked",
      severity: "critical",
      taskId: task.id,
      relatedTaskIds: downstream.map((d) => d.id),
      message:
        `Mandatory task ${quote(task)} is blocked${task.blockedReason ? `: ${task.blockedReason}.` : "."}` +
        (downstream.length > 0
          ? ` ${plural(downstream.length, "downstream task")} cannot be completed until it is resolved.`
          : ""),
    });
  }

  const dueMilestones = milestones.filter((m) => m.status !== "Completed" && diffInDays(today, m.date) <= 0);
  for (const m of dueMilestones) {
    reasons.push({
      kind: "milestone-due",
      severity: "critical",
      relatedTaskIds: m.openTasks.map((t) => t.id),
      message: `${m.label} ${diffInDays(today, m.date) === 0 ? "is today" : `was due on ${formatShortDate(m.date)}`} and ${plural(
        m.openTasks.length,
        "mandatory task is",
        "mandatory tasks are",
      )} still open.`,
    });
  }

  // --- Warning rules (AT RISK) ----------------------------------------------------------
  const dueSoon = openRequired.filter(
    (t) => t.status !== "Blocked" && isTaskDueSoon(t, today, DUE_SOON_WINDOW_DAYS),
  );
  const waiting = openRequired.filter(
    (t) =>
      t.status !== "Completed" &&
      getUnresolvedPrerequisites(tasks, t).length > 0 &&
      (t.status === "In progress" || isTaskDueSoon(t, today)),
  );
  for (const task of dueSoon) {
    if (waiting.includes(task)) continue; // reported with its dependency below
    const days = diffInDays(today, task.dueDate);
    reasons.push({
      kind: "due-soon",
      severity: "warning",
      taskId: task.id,
      relatedTaskIds: [],
      message: `Mandatory task ${quote(task)} is ${task.status.toLowerCase()} and due ${
        days === 0 ? "today" : `in ${plural(days, "day")}`
      }.`,
    });
  }
  for (const task of waiting) {
    const prerequisites = getUnresolvedPrerequisites(tasks, task);
    reasons.push({
      kind: "waiting-on-prerequisite",
      severity: "warning",
      taskId: task.id,
      relatedTaskIds: prerequisites.map((p) => p.id),
      message: `${quote(task)} is due ${formatShortDate(task.dueDate)} but still depends on ${prerequisites
        .map((p) => `${quote(p)} — ${p.status.toLowerCase()}`)
        .join(", ")}.`,
    });
  }
  const completedEarly = tasks.filter((t) => t.status === "Completed" && !isEffectivelyComplete(tasks, t));
  for (const task of completedEarly) {
    const prerequisites = getUnresolvedPrerequisites(tasks, task);
    reasons.push({
      kind: "completed-before-prerequisite",
      severity: "warning",
      taskId: task.id,
      relatedTaskIds: prerequisites.map((p) => p.id),
      message: `${quote(task)} is marked completed, but its prerequisite ${prerequisites
        .map(quote)
        .join(", ")} is not. It does not count towards readiness until the prerequisite is done.`,
    });
  }

  const label = target?.label ?? "the next milestone";
  const rules: ReadinessRule[] = [
    { id: "no-overdue", label: "No mandatory task is overdue", failsTo: "Not ready", passed: overdue.length === 0 },
    { id: "no-blocked", label: "No mandatory task is blocked", failsTo: "Not ready", passed: blocked.length === 0 },
    {
      id: "no-due-milestone-open",
      label: "No milestone is due with mandatory tasks still open",
      failsTo: "Not ready",
      passed: dueMilestones.length === 0,
    },
    {
      id: "no-due-soon",
      label: `No open mandatory task for ${label} is due within ${DUE_SOON_WINDOW_DAYS} days`,
      failsTo: "At risk",
      passed: dueSoon.length === 0,
    },
    {
      id: "prerequisites-resolved",
      label: "No task that is due soon or in progress is waiting on an open prerequisite",
      failsTo: "At risk",
      passed: waiting.length === 0,
    },
    {
      id: "completion-order",
      label: "No task is marked completed before its prerequisite",
      failsTo: "At risk",
      passed: completedEarly.length === 0,
    },
    {
      id: "milestone-complete",
      label: `All mandatory tasks for ${label} are completed`,
      failsTo: "On track",
      passed: openRequired.length === 0,
    },
  ];

  const failed = (outcome: ReadinessRule["failsTo"]) => rules.some((r) => r.failsTo === outcome && !r.passed);
  const status: ReadinessStatus = failed("Not ready")
    ? "Not ready"
    : failed("At risk")
      ? "At risk"
      : failed("On track")
        ? "On track"
        : "Ready";

  const requiredCompleted = required.length - openRequired.length;
  const critical = reasons.filter((r) => r.severity === "critical").length;
  const warnings = reasons.length - critical;

  let headline: string;
  if (!target) headline = "All milestones reached — onboarding complete.";
  else if (status === "Ready")
    headline = `All ${required.length} mandatory tasks for ${target.label} are completed.`;
  else if (status === "On track")
    headline = `${requiredCompleted} of ${required.length} mandatory tasks for ${target.label} completed; nothing is due within ${DUE_SOON_WINDOW_DAYS} days.`;
  else if (status === "At risk")
    headline = `${plural(warnings, "warning")} for ${target.label}; no critical blocker.`;
  else headline = `${plural(critical, "critical issue")} must be resolved${warnings ? `, plus ${plural(warnings, "warning")}` : ""}.`;

  return {
    status,
    milestone: target,
    headline,
    reasons,
    rules,
    requiredTasks: required,
    requiredCompleted,
  };
}

/* ------------------------------------------------------------------ */
/* Cross-case views                                                    */
/* ------------------------------------------------------------------ */

export type CriticalTaskItem = {
  caseId: string;
  employeeName: string;
  task: OnboardingTask;
  severity: "critical" | "warning";
  /** Short labels, e.g. "Overdue 3d", "Blocked", "Held up by …". */
  flags: string[];
};

/**
 * Open mandatory tasks that put readiness at risk, across all cases:
 * overdue, blocked, held up by an upstream problem, or due within 7 days.
 * Critical items first, then by due date.
 */
export function getCriticalTasks(cases: readonly OnboardingCase[], today: ISODate): CriticalTaskItem[] {
  const items: CriticalTaskItem[] = [];
  for (const c of cases) {
    const downstream = new Map(getBlockedDownstream(c, today).map((d) => [d.task.id, d]));
    for (const task of c.tasks) {
      if (!task.mandatory || task.status === "Completed") continue;
      const flags: string[] = [];
      let severity: CriticalTaskItem["severity"] | null = null;
      if (isTaskOverdue(task, today)) {
        flags.push(`Overdue ${Math.abs(diffInDays(today, task.dueDate))}d`);
        severity = "critical";
      }
      if (task.status === "Blocked") {
        flags.push("Blocked");
        severity = "critical";
      }
      const upstream = downstream.get(task.id);
      if (upstream) {
        flags.push(`Held up by “${upstream.blocker.title}”`);
        severity = "critical";
      }
      if (!severity && isTaskDueSoon(task, today)) {
        const days = diffInDays(today, task.dueDate);
        flags.push(days === 0 ? "Due today" : `Due in ${days}d`);
        if (getUnresolvedPrerequisites(c.tasks, task).length > 0) flags.push("Waiting on prerequisite");
        severity = "warning";
      }
      if (severity) items.push({ caseId: c.id, employeeName: c.employeeName, task, severity, flags });
    }
  }
  return items.sort(
    (a, b) =>
      (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1) ||
      a.task.dueDate.localeCompare(b.task.dueDate),
  );
}

export function countByReadiness(
  cases: readonly OnboardingCase[],
  today: ISODate,
): Record<ReadinessStatus, number> {
  const counts: Record<ReadinessStatus, number> = { "Not ready": 0, "At risk": 0, "On track": 0, Ready: 0 };
  for (const c of cases) counts[assessReadiness(c, today).status]++;
  return counts;
}
