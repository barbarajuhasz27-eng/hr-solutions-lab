import { diffInDays } from "@/lib/dates";
import { getPrerequisites, isEffectivelyComplete } from "@/lib/dependencies";
import { isCaseActive, isTaskOverdue } from "@/lib/metrics";
import { assessReadiness, READINESS_STATUSES, type ReadinessStatus } from "@/lib/readiness";
import {
  ONBOARDING_STAGES,
  TASK_OWNERS,
  type ISODate,
  type OnboardingCase,
  type OnboardingStage,
  type OnboardingTask,
  type TaskOwner,
} from "@/types/onboarding";

/**
 * Process intelligence: aggregate KPIs calculated from the cases in the workspace.
 *
 * In this prototype the cases are synthetic demo data, so every figure is illustrative.
 * The KPIs describe the dataset; they are not validated business results and no savings,
 * productivity or retention effects are inferred from them.
 */

export const KPI_DEFINITIONS = {
  day1Readiness:
    "Share of cases whose start date has passed (or is today) where every mandatory pre-boarding and Day 1 task was completed on or before the start date, with its mandatory prerequisites also completed.",
  readinessMix:
    "Current readiness status of each active case, from the rule-based readiness assessment (Not ready, At risk, On track, Ready).",
  completionByStage:
    "For each stage, the share of tasks already due (due date today or earlier) that are completed. Tasks not yet due are excluded so future stages are not shown as behind.",
  overdueByOwner:
    "Open tasks past their due date, grouped by the owning team. The overdue share is overdue tasks divided by all open tasks for that owner.",
  handoverDelays:
    "A handover is a dependency where the prerequisite and the dependent task belong to different teams. A handover is delayed when the prerequisite was completed after its due date, or is still open and overdue. Delay is measured in days past the prerequisite's due date. Only handovers whose prerequisite is already due are counted.",
  recurringBlockers:
    "Tasks from the same template that have been blocked at least once (now or earlier) in two or more cases.",
  stakeholderDistribution:
    "Number of tasks assigned to each owner across all cases, with the share of the total and how many are still open.",
} as const;

/* ------------------------------------------------------------------ */

export type Day1Readiness = {
  eligible: number;
  ready: number;
  /** Percentage, or null when no case has started yet. */
  rate: number | null;
  notReadyCases: { caseId: string; employeeName: string; missing: OnboardingTask[] }[];
};

export function getDay1Readiness(cases: readonly OnboardingCase[], today: ISODate): Day1Readiness {
  const started = cases.filter((c) => diffInDays(today, c.startDate) <= 0);
  const notReadyCases: Day1Readiness["notReadyCases"] = [];
  let ready = 0;
  for (const c of started) {
    const day1 = c.tasks.filter((t) => t.mandatory && (t.stage === "Pre-boarding" || t.stage === "Day 1"));
    const missing = day1.filter(
      (t) =>
        !isEffectivelyComplete(c.tasks, t) ||
        !t.completedAt ||
        diffInDays(c.startDate, t.completedAt) > 0,
    );
    if (missing.length === 0) ready++;
    else notReadyCases.push({ caseId: c.id, employeeName: c.employeeName, missing });
  }
  return {
    eligible: started.length,
    ready,
    rate: started.length === 0 ? null : Math.round((ready / started.length) * 100),
    notReadyCases,
  };
}

export function getReadinessMix(
  cases: readonly OnboardingCase[],
  today: ISODate,
): Record<ReadinessStatus, number> {
  const mix = Object.fromEntries(READINESS_STATUSES.map((s) => [s, 0])) as Record<ReadinessStatus, number>;
  for (const c of cases.filter(isCaseActive)) mix[assessReadiness(c, today).status]++;
  return mix;
}

/* ------------------------------------------------------------------ */

export type StageCompletion = {
  stage: OnboardingStage;
  totalTasks: number;
  dueTasks: number;
  dueCompleted: number;
  /** Percentage of due tasks completed, or null when nothing in the stage is due yet. */
  rate: number | null;
};

export function getCompletionByStage(cases: readonly OnboardingCase[], today: ISODate): StageCompletion[] {
  const tasks = cases.flatMap((c) => c.tasks);
  return ONBOARDING_STAGES.map((stage) => {
    const inStage = tasks.filter((t) => t.stage === stage);
    const due = inStage.filter((t) => diffInDays(today, t.dueDate) <= 0);
    const dueCompleted = due.filter((t) => t.status === "Completed").length;
    return {
      stage,
      totalTasks: inStage.length,
      dueTasks: due.length,
      dueCompleted,
      rate: due.length === 0 ? null : Math.round((dueCompleted / due.length) * 100),
    };
  });
}

/* ------------------------------------------------------------------ */

export type OwnerLoad = {
  owner: TaskOwner;
  total: number;
  open: number;
  completed: number;
  overdue: number;
  /** Overdue as a percentage of open tasks, or null when nothing is open. */
  overdueShare: number | null;
  /** Share of all tasks in the workspace (percentage). */
  shareOfTotal: number;
};

export function getOwnerLoad(cases: readonly OnboardingCase[], today: ISODate): OwnerLoad[] {
  const tasks = cases.flatMap((c) => c.tasks);
  return TASK_OWNERS.map((owner) => {
    const own = tasks.filter((t) => t.owner === owner);
    const open = own.filter((t) => t.status !== "Completed");
    const overdue = open.filter((t) => isTaskOverdue(t, today)).length;
    return {
      owner,
      total: own.length,
      open: open.length,
      completed: own.length - open.length,
      overdue,
      overdueShare: open.length === 0 ? null : Math.round((overdue / open.length) * 100),
      shareOfTotal: tasks.length === 0 ? 0 : Math.round((own.length / tasks.length) * 100),
    };
  }).filter((o) => o.total > 0);
}

/** Owners sorted by overdue count (desc), then by open tasks. */
export function getOverdueByOwner(cases: readonly OnboardingCase[], today: ISODate): OwnerLoad[] {
  return getOwnerLoad(cases, today).sort((a, b) => b.overdue - a.overdue || b.open - a.open);
}

/** Owners sorted by total task count (desc). */
export function getStakeholderDistribution(cases: readonly OnboardingCase[], today: ISODate): OwnerLoad[] {
  return getOwnerLoad(cases, today).sort((a, b) => b.total - a.total);
}

/* ------------------------------------------------------------------ */

export type Handover = {
  caseId: string;
  employeeName: string;
  from: TaskOwner;
  to: TaskOwner;
  prerequisite: OnboardingTask;
  dependent: OnboardingTask;
  delayDays: number;
  /** True when the prerequisite is still open (the delay is still growing). */
  ongoing: boolean;
};

export type HandoverRoute = {
  route: string;
  from: TaskOwner;
  to: TaskOwner;
  handovers: number;
  delayed: number;
  averageDelayDays: number | null;
};

export type HandoverSummary = {
  /** Cross-team handovers whose prerequisite is already due. */
  evaluated: number;
  delayed: number;
  ongoing: number;
  averageDelayDays: number | null;
  routes: HandoverRoute[];
  delayedHandovers: Handover[];
};

export function getHandovers(cases: readonly OnboardingCase[], today: ISODate): Handover[] {
  const handovers: Handover[] = [];
  for (const c of cases) {
    for (const dependent of c.tasks) {
      for (const prerequisite of getPrerequisites(c.tasks, dependent)) {
        if (prerequisite.owner === dependent.owner) continue;
        if (diffInDays(today, prerequisite.dueDate) > 0) continue; // not due yet: cannot be late
        const ongoing = prerequisite.status !== "Completed";
        const finishedOn = ongoing ? today : (prerequisite.completedAt ?? prerequisite.dueDate);
        handovers.push({
          caseId: c.id,
          employeeName: c.employeeName,
          from: prerequisite.owner,
          to: dependent.owner,
          prerequisite,
          dependent,
          delayDays: Math.max(0, diffInDays(prerequisite.dueDate, finishedOn)),
          ongoing,
        });
      }
    }
  }
  return handovers;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export function getHandoverSummary(cases: readonly OnboardingCase[], today: ISODate): HandoverSummary {
  const all = getHandovers(cases, today);
  const delayed = all.filter((h) => h.delayDays > 0);
  const routes = new Map<string, HandoverRoute & { delays: number[] }>();
  for (const h of all) {
    const route = `${h.from} → ${h.to}`;
    const entry = routes.get(route) ?? {
      route,
      from: h.from,
      to: h.to,
      handovers: 0,
      delayed: 0,
      averageDelayDays: null,
      delays: [],
    };
    entry.handovers++;
    if (h.delayDays > 0) {
      entry.delayed++;
      entry.delays.push(h.delayDays);
    }
    routes.set(route, entry);
  }
  return {
    evaluated: all.length,
    delayed: delayed.length,
    ongoing: delayed.filter((h) => h.ongoing).length,
    averageDelayDays: average(delayed.map((h) => h.delayDays)),
    routes: [...routes.values()]
      .map(({ delays, ...r }) => ({ ...r, averageDelayDays: average(delays) }))
      .sort((a, b) => b.delayed - a.delayed || b.handovers - a.handovers),
    delayedHandovers: delayed.sort((a, b) => b.delayDays - a.delayDays),
  };
}

/* ------------------------------------------------------------------ */

export type BlockerPattern = {
  templateKey: string;
  title: string;
  owner: TaskOwner;
  casesAffected: number;
  currentlyBlocked: number;
  recurring: boolean;
  reasons: string[];
  employees: string[];
};

export function getBlockerPatterns(cases: readonly OnboardingCase[]): BlockerPattern[] {
  const patterns = new Map<string, BlockerPattern>();
  for (const c of cases) {
    for (const t of c.tasks) {
      if (t.blockedCount === 0 && t.status !== "Blocked") continue;
      const p = patterns.get(t.templateKey) ?? {
        templateKey: t.templateKey,
        title: t.title,
        owner: t.owner,
        casesAffected: 0,
        currentlyBlocked: 0,
        recurring: false,
        reasons: [],
        employees: [],
      };
      p.casesAffected++;
      p.employees.push(c.employeeName);
      if (t.status === "Blocked") p.currentlyBlocked++;
      if (t.blockedReason && !p.reasons.includes(t.blockedReason)) p.reasons.push(t.blockedReason);
      p.recurring = p.casesAffected >= 2;
      patterns.set(t.templateKey, p);
    }
  }
  return [...patterns.values()].sort(
    (a, b) => b.casesAffected - a.casesAffected || b.currentlyBlocked - a.currentlyBlocked,
  );
}
