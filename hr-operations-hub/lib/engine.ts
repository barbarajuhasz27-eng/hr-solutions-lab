import type {
  Activity,
  ActivityStatus,
  ActionInstance,
  Readiness,
  RecoveryGroup,
} from "./model";

const RECOVERY_WINDOW_MINUTES = 60;

export function getActionDueAt(startsAt: string, offsetMinutes: number): Date {
  return new Date(new Date(startsAt).getTime() + offsetMinutes * 60_000);
}

export function isActionResolved(action: ActionInstance): boolean {
  return action.status === "done" || action.status === "skipped";
}

export function getReadiness(activity: Activity, now: Date): Readiness {
  if (activity.completedAt) {
    return { status: "completed", label: "Completed", unresolvedEssential: [] };
  }

  const unresolvedEssential = activity.actions.filter(
    (action) => action.criticality === "essential" && !isActionResolved(action),
  );

  const remainingMinutes = (new Date(activity.startsAt).getTime() - now.getTime()) / 60_000;

  let status: ActivityStatus = "ready";
  if (unresolvedEssential.length > 0) {
    const hasBlocker = unresolvedEssential.some(
      (action) => action.status === "blocked" || action.status === "waiting",
    );
    const unresolvedDueDates = unresolvedEssential.map((action) =>
      getActionDueAt(activity.startsAt, action.dueOffsetMinutes).getTime(),
    );
    const hasOverdueEssential = unresolvedDueDates.some((dueAt) => dueAt < now.getTime());
    const hasEssentialDueSoon = unresolvedDueDates.some(
      (dueAt) => dueAt <= now.getTime() + 24 * 60 * 60_000,
    );

    if (remainingMinutes <= RECOVERY_WINDOW_MINUTES) {
      status = "recovery";
    } else if (hasBlocker || hasOverdueEssential) {
      status = "at-risk";
    } else if (hasEssentialDueSoon) {
      status = "needs-attention";
    } else {
      status = "preparing";
    }
  } else {
    const otherOpen = activity.actions.some(
      (action) => action.criticality !== "essential" && !isActionResolved(action),
    );
    status = otherOpen ? "preparing" : "ready";
  }

  if (activity.startsAt && new Date(activity.startsAt).getTime() < now.getTime() && unresolvedEssential.length > 0) {
    status = "at-risk";
  }

  const labels: Record<ActivityStatus, string> = {
    planned: "Planned",
    preparing: "Preparing",
    "needs-attention": "Needs attention",
    "at-risk": "At risk",
    recovery: "Recovery",
    ready: "Ready",
    completed: "Completed",
    cancelled: "Cancelled",
  };

  return { status, label: labels[status], unresolvedEssential };
}

export function getRecoveryPlan(activity: Activity, now: Date): RecoveryGroup[] {
  const remainingMinutes = Math.max(
    0,
    Math.floor((new Date(activity.startsAt).getTime() - now.getTime()) / 60_000),
  );
  const unresolved = activity.actions.filter((action) => !isActionResolved(action));
  const byId = new Map(activity.actions.map((action) => [action.id, action]));

  const mustDoNow: ActionInstance[] = [];
  const canSimplify: ActionInstance[] = [];
  const followUp: ActionInstance[] = [];
  const blocked: ActionInstance[] = [];

  for (const action of unresolved) {
    const dependencies = action.dependsOn
      .map((id) => byId.get(id))
      .filter((dependency): dependency is ActionInstance => Boolean(dependency));
    const waitingOnDependency = dependencies.some((dependency) => !isActionResolved(dependency));

    if (waitingOnDependency || action.status === "blocked" || action.status === "waiting") {
      blocked.push(action);
      continue;
    }

    if (action.criticality === "essential") {
      if (action.estimatedMinutes <= remainingMinutes) {
        mustDoNow.push(action);
      } else if (action.fallback) {
        canSimplify.push(action);
      } else {
        blocked.push(action);
      }
      continue;
    }

    if (action.fallback) {
      canSimplify.push(action);
    } else {
      followUp.push(action);
    }
  }

  const order = (a: ActionInstance, b: ActionInstance) =>
    a.dueOffsetMinutes - b.dueOffsetMinutes || a.estimatedMinutes - b.estimatedMinutes;

  mustDoNow.sort(order);
  canSimplify.sort(order);
  followUp.sort(order);
  blocked.sort(order);

  return [
    {
      id: "must-do-now",
      title: "Must do now",
      description: "Essential actions that can still be completed before the activity starts.",
      actions: mustDoNow,
    },
    {
      id: "can-simplify",
      title: "Can simplify",
      description: "Use the playbook fallback to reduce preparation without silently dropping the activity.",
      actions: canSimplify,
    },
    {
      id: "blocked",
      title: "Blocked / needs someone else",
      description: "A prerequisite or another stakeholder must act before this step can move.",
      actions: blocked,
    },
    {
      id: "follow-up",
      title: "Can follow up later",
      description: "Useful actions that do not prevent the activity from starting.",
      actions: followUp,
    },
  ];
}

export function applyActionUpdate(
  activities: Activity[],
  activityId: string,
  actionId: string,
  update: Partial<Pick<ActionInstance, "status" | "statusNote" | "fallbackUsed">>,
): Activity[] {
  return activities.map((activity) =>
    activity.id !== activityId
      ? activity
      : {
          ...activity,
          actions: activity.actions.map((action) =>
            action.id === actionId ? { ...action, ...update } : action,
          ),
        },
  );
}
