import { addDays, diffInDays } from "@/lib/dates";
import { isEffectivelyComplete } from "@/lib/dependencies";
import {
  ONBOARDING_STAGES,
  type ISODate,
  type OnboardingCase,
  type OnboardingStage,
  type OnboardingTask,
  type TaskOwner,
  type TaskStatus,
} from "@/types/onboarding";

export const DUE_SOON_WINDOW_DAYS = 7;
export const UPCOMING_START_WINDOW_DAYS = 30;

/* ------------------------------------------------------------------ */
/* Task-level rules                                                    */
/* ------------------------------------------------------------------ */

export function isTaskComplete(task: OnboardingTask): boolean {
  return task.status === "Completed";
}

/** A task is overdue when its due date has passed and it is not completed. */
export function isTaskOverdue(task: OnboardingTask, today: ISODate): boolean {
  if (isTaskComplete(task)) return false;
  return diffInDays(today, task.dueDate) < 0;
}

/** Not completed, and due today or within the next `windowDays` days. */
export function isTaskDueSoon(
  task: OnboardingTask,
  today: ISODate,
  windowDays: number = DUE_SOON_WINDOW_DAYS,
): boolean {
  if (isTaskComplete(task)) return false;
  const days = diffInDays(today, task.dueDate);
  return days >= 0 && days <= windowDays;
}

export function needsAttention(task: OnboardingTask, today: ISODate): boolean {
  return task.status === "Blocked" || isTaskOverdue(task, today);
}

/** Completion percentage, rounded to a whole number, based on the total task count. */
export function completionPercent(tasks: readonly OnboardingTask[]): number {
  if (tasks.length === 0) return 0;
  const completed = tasks.filter(isTaskComplete).length;
  return Math.round((completed / tasks.length) * 100);
}

export function sortTasksByDueDate<T extends OnboardingTask>(tasks: readonly T[]): T[] {
  return [...tasks].sort(
    (a, b) =>
      a.dueDate.localeCompare(b.dueDate) ||
      ONBOARDING_STAGES.indexOf(a.stage) - ONBOARDING_STAGES.indexOf(b.stage),
  );
}

/* ------------------------------------------------------------------ */
/* Case-level rules                                                    */
/* ------------------------------------------------------------------ */

export type CaseStage = OnboardingStage | "Completed";

export function isCaseComplete(onboarding: OnboardingCase): boolean {
  return onboarding.tasks.length > 0 && onboarding.tasks.every(isTaskComplete);
}

export function isCaseActive(onboarding: OnboardingCase): boolean {
  return !isCaseComplete(onboarding);
}

/** The earliest stage that still has open tasks; "Completed" when everything is done. */
export function currentStage(onboarding: OnboardingCase): CaseStage {
  for (const stage of ONBOARDING_STAGES) {
    if (onboarding.tasks.some((task) => task.stage === stage && !isTaskComplete(task))) {
      return stage;
    }
  }
  return "Completed";
}

export type CaseHealth = "On track" | "Needs attention" | "Completed";

export function caseHealth(onboarding: OnboardingCase, today: ISODate): CaseHealth {
  if (isCaseComplete(onboarding)) return "Completed";
  return onboarding.tasks.some((task) => needsAttention(task, today))
    ? "Needs attention"
    : "On track";
}

/* ------------------------------------------------------------------ */
/* Milestones                                                          */
/* ------------------------------------------------------------------ */

export type MilestoneKey = "day-1" | "day-30" | "day-60" | "day-90";
export type MilestoneStatus = "Completed" | "Overdue" | "Due soon" | "Upcoming";

type MilestoneDefinition = {
  key: MilestoneKey;
  label: string;
  offsetDays: number;
  /** Stages whose tasks must be complete for this milestone to count as reached. */
  stages: readonly OnboardingStage[];
};

export const MILESTONES: readonly MilestoneDefinition[] = [
  { key: "day-1", label: "Day 1", offsetDays: 0, stages: ["Pre-boarding", "Day 1"] },
  { key: "day-30", label: "Day 30", offsetDays: 30, stages: ["First 30 days"] },
  { key: "day-60", label: "Day 60", offsetDays: 60, stages: ["Day 60"] },
  { key: "day-90", label: "Day 90", offsetDays: 90, stages: ["Day 90"] },
];

export type Milestone = {
  key: MilestoneKey;
  label: string;
  date: ISODate;
  status: MilestoneStatus;
  /** Mandatory tasks in the milestone's stages that are effectively complete. */
  completedTasks: number;
  /** Mandatory tasks in the milestone's stages. Optional tasks never gate a milestone. */
  totalTasks: number;
  optionalTasks: number;
  blockedTasks: number;
  /** Mandatory tasks that are not yet effectively complete. */
  openTasks: OnboardingTask[];
};

/** The tasks (mandatory and optional) belonging to a milestone's stages. */
export function tasksForMilestone(onboarding: OnboardingCase, key: MilestoneKey): OnboardingTask[] {
  const definition = MILESTONES.find((m) => m.key === key)!;
  return onboarding.tasks.filter((task) => definition.stages.includes(task.stage));
}

/**
 * A milestone is reached ("Completed") when every *mandatory* task in its stages is
 * effectively complete: marked Completed, with all mandatory prerequisites completed too.
 */
export function getMilestones(onboarding: OnboardingCase, today: ISODate): Milestone[] {
  return MILESTONES.map((definition) => {
    const tasks = onboarding.tasks.filter((task) => definition.stages.includes(task.stage));
    const mandatory = tasks.filter((task) => task.mandatory);
    const openTasks = mandatory.filter((task) => !isEffectivelyComplete(onboarding.tasks, task));
    const date = addDays(onboarding.startDate, definition.offsetDays);
    const daysUntil = diffInDays(today, date);

    let status: MilestoneStatus;
    if (openTasks.length === 0) status = "Completed";
    else if (daysUntil < 0) status = "Overdue";
    else if (daysUntil <= DUE_SOON_WINDOW_DAYS) status = "Due soon";
    else status = "Upcoming";

    return {
      key: definition.key,
      label: definition.label,
      date,
      status,
      completedTasks: mandatory.length - openTasks.length,
      totalTasks: mandatory.length,
      optionalTasks: tasks.length - mandatory.length,
      blockedTasks: tasks.filter((task) => task.status === "Blocked").length,
      openTasks,
    };
  });
}

/**
 * The next milestone: the first one dated today or later. After Day 90 has passed, the first
 * milestone not yet reached, or null when every milestone is reached. Missed earlier
 * milestones show as Overdue in the milestone list.
 */
export function pickNextMilestone(milestones: Milestone[], today: ISODate): Milestone | null {
  return (
    milestones.find((m) => diffInDays(today, m.date) >= 0) ??
    milestones.find((m) => m.status !== "Completed") ??
    null
  );
}

export function nextMilestone(onboarding: OnboardingCase, today: ISODate): Milestone | null {
  return pickNextMilestone(getMilestones(onboarding, today), today);
}

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

export type DashboardMetrics = {
  upcomingStarts: number;
  activeOnboardings: number;
  overdueTasks: number;
  blockedTasks: number;
  completedTasks: number;
  totalTasks: number;
  overallCompletion: number;
};

export function isUpcomingStart(
  onboarding: OnboardingCase,
  today: ISODate,
  windowDays: number = UPCOMING_START_WINDOW_DAYS,
): boolean {
  const days = diffInDays(today, onboarding.startDate);
  return days >= 0 && days <= windowDays;
}

export function getDashboardMetrics(
  cases: readonly OnboardingCase[],
  today: ISODate,
): DashboardMetrics {
  const allTasks = cases.flatMap((c) => c.tasks);
  const completedTasks = allTasks.filter(isTaskComplete).length;
  return {
    upcomingStarts: cases.filter((c) => isUpcomingStart(c, today)).length,
    activeOnboardings: cases.filter(isCaseActive).length,
    overdueTasks: allTasks.filter((task) => isTaskOverdue(task, today)).length,
    blockedTasks: allTasks.filter((task) => task.status === "Blocked").length,
    completedTasks,
    totalTasks: allTasks.length,
    overallCompletion: completionPercent(allTasks),
  };
}

export type CaseTask = OnboardingTask & {
  caseId: string;
  employeeName: string;
  jobTitle: string;
  department: string;
};

export function flattenTasks(cases: readonly OnboardingCase[]): CaseTask[] {
  return cases.flatMap((c) =>
    c.tasks.map((task) => ({
      ...task,
      caseId: c.id,
      employeeName: c.employeeName,
      jobTitle: c.jobTitle,
      department: c.department,
    })),
  );
}

export type AttentionItem = CaseTask & { isOverdue: boolean; isBlocked: boolean };

/** Overdue and blocked tasks across all cases, earliest due date first. */
export function getAttentionItems(
  cases: readonly OnboardingCase[],
  today: ISODate,
): AttentionItem[] {
  return sortTasksByDueDate(
    flattenTasks(cases)
      .filter((task) => needsAttention(task, today))
      .map((task) => ({
        ...task,
        isOverdue: isTaskOverdue(task, today),
        isBlocked: task.status === "Blocked",
      })),
  );
}

export function getUpcomingStarts(
  cases: readonly OnboardingCase[],
  today: ISODate,
): OnboardingCase[] {
  return cases
    .filter((c) => isUpcomingStart(c, today))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/* ------------------------------------------------------------------ */
/* Search and filtering                                                */
/* ------------------------------------------------------------------ */

function normalise(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function matchesCaseQuery(onboarding: Pick<OnboardingCase, "employeeName" | "jobTitle" | "department">, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;
  return [onboarding.employeeName, onboarding.jobTitle, onboarding.department].some((field) =>
    normalise(field).includes(q),
  );
}

export type StatusFilter = "All" | TaskStatus | "Overdue";
export type OwnerFilter = "All" | TaskOwner;

export type RequirementFilter = "All" | "Mandatory" | "Optional";

export type TaskFilters = {
  status: StatusFilter;
  owner: OwnerFilter;
  requirement?: RequirementFilter;
  query?: string;
};

export function matchesStatusFilter(
  task: OnboardingTask,
  status: StatusFilter,
  today: ISODate,
): boolean {
  if (status === "All") return true;
  if (status === "Overdue") return isTaskOverdue(task, today);
  return task.status === status;
}

type SearchableTask = OnboardingTask &
  Partial<Pick<CaseTask, "employeeName" | "jobTitle" | "department">>;

/** Filters by status (including the derived "Overdue" state), owner and free-text search. */
export function filterTasks<T extends SearchableTask>(
  tasks: readonly T[],
  filters: TaskFilters,
  today: ISODate,
): T[] {
  const q = normalise(filters.query ?? "");
  return tasks.filter((task) => {
    if (!matchesStatusFilter(task, filters.status, today)) return false;
    if (filters.owner !== "All" && task.owner !== filters.owner) return false;
    if (filters.requirement === "Mandatory" && !task.mandatory) return false;
    if (filters.requirement === "Optional" && task.mandatory) return false;
    if (!q) return true;
    return [task.title, task.owner, task.employeeName, task.jobTitle, task.department].some(
      (field) => field !== undefined && normalise(field).includes(q),
    );
  });
}
