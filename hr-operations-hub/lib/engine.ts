/**
 * M0 readiness and Rapid Recovery engine on the Activity view model. Since M1 it runs on v3 data through
 * `lib/store/activity-adapter.ts`; M3 replaces it with the occurrence-based engine (§7).
 */
import { HOLD_NOTE_MAX_LENGTH, WAITING_ON_MAX_LENGTH } from "./domain/reducer";
import { formatDuration } from "./format";
import type {
  Activity,
  ActivityStatus,
  ActionInstance,
  ActionUpdate,
  Readiness,
  ReadinessReason,
  ReadinessReasonKind,
  RecoveryGroup,
} from "./model";

/** Within this many minutes of the start, an activity with open essentials switches to Rapid Recovery. */
export const RECOVERY_WINDOW_MINUTES = 60;
/** Essential actions due within this window — or waiting on someone inside it — need attention. */
export const ATTENTION_WINDOW_MINUTES = 24 * 60;

export { formatDuration, HOLD_NOTE_MAX_LENGTH, WAITING_ON_MAX_LENGTH };

type ActionIndex = Map<string, ActionInstance>;

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

export function getActionDueAt(startsAt: string, offsetMinutes: number): Date {
  return new Date(new Date(startsAt).getTime() + offsetMinutes * 60_000);
}

function minutesUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / 60_000;
}

// ---------------------------------------------------------------------------
// Action and dependency helpers
// ---------------------------------------------------------------------------

export function isActionResolved(action: ActionInstance): boolean {
  return action.status === "done" || action.status === "skipped";
}

export function isActionOnHold(action: ActionInstance): boolean {
  return action.status === "waiting" || action.status === "blocked";
}

function indexActions(activity: Activity): ActionIndex {
  return new Map(activity.actions.map((action) => [action.id, action] as const));
}

function openPrerequisites(action: ActionInstance, byId: ActionIndex): ActionInstance[] {
  return action.dependsOn
    .map((id) => byId.get(id))
    .filter((dependency): dependency is ActionInstance => dependency !== undefined && !isActionResolved(dependency));
}

/** Sum of estimated minutes for the given actions plus all of their unresolved prerequisites, each counted once. */
function remainingWorkMinutes(actionIds: string[], byId: ActionIndex): number {
  const seen = new Set<string>();
  let total = 0;
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const action = byId.get(id);
    if (!action || isActionResolved(action)) return;
    total += action.estimatedMinutes;
    action.dependsOn.forEach(visit);
  };
  actionIds.forEach(visit);
  return total;
}

/** Remaining work for one action including its unresolved prerequisite chain. */
export function getRequiredMinutes(activity: Activity, actionId: string): number {
  return remainingWorkMinutes([actionId], indexActions(activity));
}

export interface DependencyInfo {
  prerequisites: { action: ActionInstance; resolved: boolean }[];
  openPrerequisites: ActionInstance[];
  /** Actions that cannot start until this one is resolved. */
  dependents: ActionInstance[];
}

export function getDependencyInfo(activity: Activity, actionId: string): DependencyInfo {
  const byId = indexActions(activity);
  const action = byId.get(actionId);
  if (!action) return { prerequisites: [], openPrerequisites: [], dependents: [] };
  const prerequisites = action.dependsOn
    .map((id) => byId.get(id))
    .filter((dependency): dependency is ActionInstance => dependency !== undefined)
    .map((dependency) => ({ action: dependency, resolved: isActionResolved(dependency) }));
  return {
    prerequisites,
    openPrerequisites: prerequisites.filter((item) => !item.resolved).map((item) => item.action),
    dependents: activity.actions.filter((candidate) => candidate.dependsOn.includes(actionId)),
  };
}

function holdDescription(action: ActionInstance): string {
  const who = action.waitingOn?.trim() || "another person or team";
  return action.statusNote ? `waiting on ${who} — ${action.statusNote}` : `waiting on ${who}`;
}

// ---------------------------------------------------------------------------
// Action risk
// ---------------------------------------------------------------------------

type ActionRiskKind = Extract<
  ReadinessReasonKind,
  "blocked" | "deadline-passed" | "waiting-near-deadline" | "insufficient-time" | "dependency-risk"
>;

export interface ActionRisk {
  kind: ActionRiskKind;
  message: string;
}

const RISK_AS_DEPENDENCY: Record<ActionRiskKind, string> = {
  blocked: "it is blocked",
  "deadline-passed": "its deadline has passed",
  "waiting-near-deadline": "it is still waiting on someone close to its deadline",
  "insufficient-time": "there is not enough time left to complete it",
  "dependency-risk": "it depends on another step that is at risk",
};

function assessActionRisk(
  action: ActionInstance,
  activity: Activity,
  byId: ActionIndex,
  now: Date,
  visiting: Set<string>,
): ActionRisk | null {
  if (isActionResolved(action)) return null;

  const minutesToDue = minutesUntil(getActionDueAt(activity.startsAt, action.dueOffsetMinutes), now);

  if (action.status === "blocked") {
    return { kind: "blocked", message: action.statusNote ? `Blocked — ${action.statusNote}` : "Marked as blocked." };
  }
  if (minutesToDue < 0) {
    return { kind: "deadline-passed", message: `Deadline passed ${formatDuration(-minutesToDue)} ago.` };
  }
  if (action.status === "waiting" && minutesToDue <= ATTENTION_WINDOW_MINUTES) {
    return {
      kind: "waiting-near-deadline",
      message: `Still ${holdDescription(action)}, and due in ${formatDuration(minutesToDue)}.`,
    };
  }
  const required = remainingWorkMinutes([action.id], byId);
  if (required > minutesToDue) {
    return {
      kind: "insufficient-time",
      message: `About ${required} min of work remains (including prerequisites), but the deadline is in ${formatDuration(minutesToDue)}.`,
    };
  }

  visiting.add(action.id);
  try {
    for (const prerequisite of openPrerequisites(action, byId)) {
      if (visiting.has(prerequisite.id)) continue;
      const prerequisiteRisk = assessActionRisk(prerequisite, activity, byId, now, visiting);
      if (prerequisiteRisk) {
        return {
          kind: "dependency-risk",
          message: `Cannot start until “${prerequisite.title}” is resolved, and ${RISK_AS_DEPENDENCY[prerequisiteRisk.kind]}.`,
        };
      }
    }
  } finally {
    visiting.delete(action.id);
  }
  return null;
}

/**
 * Whether an unresolved action is a genuine operational risk right now.
 * An open prerequisite on its own is not a risk — only when the prerequisite itself is at risk.
 */
export function getActionRisk(activity: Activity, actionId: string, now: Date): ActionRisk | null {
  const byId = indexActions(activity);
  const action = byId.get(actionId);
  return action ? assessActionRisk(action, activity, byId, now, new Set()) : null;
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<ActivityStatus, string> = {
  planned: "Planned",
  preparing: "Preparing",
  "needs-attention": "Needs attention",
  "at-risk": "At risk",
  recovery: "Recovery",
  ready: "Ready",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function getStatusLabel(status: ActivityStatus): string {
  return STATUS_LABELS[status];
}

function readiness(status: ActivityStatus, unresolvedEssential: ActionInstance[], reasons: ReadinessReason[]): Readiness {
  return { status, label: STATUS_LABELS[status], unresolvedEssential, reasons };
}

/**
 * Readiness is derived from essential actions only:
 * - Recovery: the activity starts within the recovery window and essentials are still open.
 * - At risk: the start has passed, or an essential action is blocked, past its deadline, waiting on
 *   someone close to its deadline, cannot be finished in the time left, or depends on a step at risk —
 *   or the remaining essential work no longer fits before the start.
 * - Needs attention: an essential action is due within 24 hours or is waiting on someone else.
 * - Preparing / Ready otherwise.
 */
export function getReadiness(activity: Activity, now: Date): Readiness {
  if (activity.completedAt) return readiness("completed", [], []);

  const byId = indexActions(activity);
  const unresolvedEssential = activity.actions
    .filter((action) => action.criticality === "essential" && !isActionResolved(action))
    .sort((a, b) => a.dueOffsetMinutes - b.dueOffsetMinutes);

  if (unresolvedEssential.length === 0) {
    const otherOpen = activity.actions.some((action) => !isActionResolved(action));
    return readiness(otherOpen ? "preparing" : "ready", [], []);
  }

  const minutesToStart = minutesUntil(new Date(activity.startsAt), now);
  const reasons: ReadinessReason[] = [];

  if (minutesToStart <= 0) {
    reasons.push({
      kind: "start-passed",
      severity: "risk",
      message: `The activity started ${formatDuration(-minutesToStart)} ago with ${unresolvedEssential.length} essential action${unresolvedEssential.length === 1 ? "" : "s"} still open.`,
    });
  }

  for (const action of unresolvedEssential) {
    const risk = assessActionRisk(action, activity, byId, now, new Set());
    if (risk) {
      reasons.push({ kind: risk.kind, severity: "risk", actionId: action.id, message: `${action.title}: ${risk.message}` });
      continue;
    }
    if (action.status === "waiting") {
      reasons.push({
        kind: "waiting",
        severity: "attention",
        actionId: action.id,
        message: `${action.title}: ${holdDescription(action)}.`,
      });
      continue;
    }
    const minutesToDue = minutesUntil(getActionDueAt(activity.startsAt, action.dueOffsetMinutes), now);
    if (minutesToDue <= ATTENTION_WINDOW_MINUTES) {
      reasons.push({
        kind: "due-soon",
        severity: "attention",
        actionId: action.id,
        message: `${action.title}: due in ${formatDuration(minutesToDue)}.`,
      });
    }
  }

  const essentialWork = remainingWorkMinutes(unresolvedEssential.map((action) => action.id), byId);
  if (minutesToStart > 0 && essentialWork > minutesToStart) {
    reasons.push({
      kind: "insufficient-time",
      severity: "risk",
      message: `About ${essentialWork} min of essential work remains, but the activity starts in ${formatDuration(minutesToStart)}.`,
    });
  }

  let status: ActivityStatus;
  if (minutesToStart <= 0) status = "at-risk";
  else if (minutesToStart <= RECOVERY_WINDOW_MINUTES) status = "recovery";
  else if (reasons.some((reason) => reason.severity === "risk")) status = "at-risk";
  else if (reasons.length > 0) status = "needs-attention";
  else status = "preparing";

  return readiness(status, unresolvedEssential, reasons);
}

const PRIORITY_RANK: Partial<Record<ActivityStatus, number>> = {
  recovery: 0,
  "at-risk": 1,
  "needs-attention": 2,
};

/**
 * The activity the Operations Radar should highlight: the most urgent upcoming activity
 * (Recovery before At risk before Needs attention, then earliest start). Activities that
 * have already started are not highlighted, because a "starts in" countdown would be meaningless.
 */
export function getPriorityActivity(
  activities: Activity[],
  now: Date,
): { activity: Activity; readiness: Readiness } | null {
  const candidates = activities
    .map((activity) => ({ activity, readiness: getReadiness(activity, now) }))
    .filter(
      (item) =>
        PRIORITY_RANK[item.readiness.status] !== undefined &&
        new Date(item.activity.startsAt).getTime() > now.getTime(),
    )
    .sort(
      (a, b) =>
        (PRIORITY_RANK[a.readiness.status] ?? 9) - (PRIORITY_RANK[b.readiness.status] ?? 9) ||
        new Date(a.activity.startsAt).getTime() - new Date(b.activity.startsAt).getTime(),
    );
  return candidates[0] ?? null;
}

// ---------------------------------------------------------------------------
// Rapid Recovery
// ---------------------------------------------------------------------------

export function getRecoveryPlan(activity: Activity, now: Date): RecoveryGroup[] {
  const remainingMinutes = Math.max(0, Math.floor(minutesUntil(new Date(activity.startsAt), now)));
  const byId = indexActions(activity);
  const unresolved = activity.actions.filter((action) => !isActionResolved(action));

  const groups: Record<RecoveryGroup["id"], { actions: ActionInstance[]; explanations: Record<string, string> }> = {
    "must-do-now": { actions: [], explanations: {} },
    "can-simplify": { actions: [], explanations: {} },
    blocked: { actions: [], explanations: {} },
    "follow-up": { actions: [], explanations: {} },
  };
  const place = (groupId: RecoveryGroup["id"], action: ActionInstance, explanation: string) => {
    groups[groupId].actions.push(action);
    groups[groupId].explanations[action.id] = explanation;
  };

  let allocatedMinutes = 0;
  const order = (a: ActionInstance, b: ActionInstance) =>
    a.dueOffsetMinutes - b.dueOffsetMinutes || a.estimatedMinutes - b.estimatedMinutes;

  for (const action of [...unresolved].sort(order)) {
    if (action.status === "blocked") {
      place("blocked", action, action.statusNote ? `Blocked — ${action.statusNote}` : "Marked as blocked.");
      continue;
    }
    if (action.status === "waiting") {
      const text = holdDescription(action);
      place("blocked", action, `${text.charAt(0).toUpperCase()}${text.slice(1)}.`);
      continue;
    }
    const prerequisites = openPrerequisites(action, byId);
    if (prerequisites.length > 0) {
      const titles = prerequisites.map((item) => `“${item.title}”`).join(" and ");
      place("blocked", action, `Can start once ${titles} ${prerequisites.length === 1 ? "is" : "are"} resolved.`);
      continue;
    }

    if (action.criticality === "essential") {
      const timeLeft = remainingMinutes - allocatedMinutes;
      if (action.estimatedMinutes <= timeLeft) {
        allocatedMinutes += action.estimatedMinutes;
        place("must-do-now", action, `Needs about ${action.estimatedMinutes} min — fits in the time remaining.`);
      } else if (action.fallback) {
        place(
          "can-simplify",
          action,
          `The full step needs about ${action.estimatedMinutes} min, but only ${Math.max(0, timeLeft)} min remain after the must-do steps.`,
        );
      } else {
        place("blocked", action, "Not enough time and no fallback defined — agree a decision with the stakeholders.");
      }
      continue;
    }

    if (action.criticality === "optional") {
      place("follow-up", action, "Optional — does not prevent the activity from starting.");
    } else if (action.fallback) {
      place("can-simplify", action, "Important but not essential — the lighter fallback keeps it on track.");
    } else {
      place("follow-up", action, "Important but not essential — can be completed after the start.");
    }
  }

  return [
    {
      id: "must-do-now",
      title: "Must do now",
      description: "Essential actions that can still be completed before the activity starts.",
      ...groups["must-do-now"],
    },
    {
      id: "can-simplify",
      title: "Can simplify",
      description: "Use the playbook fallback to reduce preparation without silently dropping the activity.",
      ...groups["can-simplify"],
    },
    {
      id: "blocked",
      title: "Blocked / needs someone else",
      description: "Waiting on another person or team, explicitly blocked, or waiting for a prerequisite step.",
      ...groups.blocked,
    },
    {
      id: "follow-up",
      title: "Can follow up later",
      description: "Useful actions that do not prevent the activity from starting.",
      ...groups["follow-up"],
    },
  ];
}

// ---------------------------------------------------------------------------
// Action updates
// ---------------------------------------------------------------------------

export interface HoldInput {
  kind: "waiting" | "blocked";
  waitingOn?: string;
  note?: string;
}

/** Returns a user-facing validation message, or null when the input is valid. */
export function validateHold(input: HoldInput): string | null {
  const who = input.waitingOn?.trim() ?? "";
  const note = input.note?.trim() ?? "";
  if (input.kind === "waiting" && !who) return "Name the person or team you are waiting on.";
  if (input.kind === "blocked" && !note) return "Add a short note explaining what is blocking this action.";
  if (who.length > WAITING_ON_MAX_LENGTH) return `Keep “waiting on” to ${WAITING_ON_MAX_LENGTH} characters or fewer.`;
  if (note.length > HOLD_NOTE_MAX_LENGTH) return `Keep the note to ${HOLD_NOTE_MAX_LENGTH} characters or fewer.`;
  return null;
}

export function holdUpdate(input: HoldInput): ActionUpdate {
  const note = input.note?.trim();
  return {
    status: input.kind,
    waitingOn: input.kind === "waiting" ? input.waitingOn?.trim() : undefined,
    statusNote: note ? note : undefined,
    fallbackUsed: false,
  };
}

export function completeUpdate(note: string): ActionUpdate {
  return { status: "done", statusNote: note, fallbackUsed: false, waitingOn: undefined };
}

export function fallbackUpdate(action: ActionInstance): ActionUpdate {
  return {
    status: "done",
    statusNote: `Fallback used: ${action.fallback ?? "simplified step"}`,
    fallbackUsed: true,
    waitingOn: undefined,
  };
}

/** Back to an open action, e.g. after reopening a done step or releasing a hold. */
export function reopenUpdate(): ActionUpdate {
  return { status: "not-started", statusNote: undefined, fallbackUsed: false, waitingOn: undefined };
}

export function applyActionUpdate(
  activities: Activity[],
  activityId: string,
  actionId: string,
  update: ActionUpdate,
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
