export type Criticality = "essential" | "important" | "optional";
export type ActionStatus =
  | "not-started"
  | "in-progress"
  | "waiting"
  | "done"
  | "blocked"
  | "skipped";

export type ActivityStatus =
  | "planned"
  | "preparing"
  | "needs-attention"
  | "at-risk"
  | "recovery"
  | "ready"
  | "completed"
  | "cancelled";

export type View = "radar" | "playbooks" | "activity" | "recovery";

export interface ActionTemplate {
  id: string;
  title: string;
  description: string;
  dueOffsetMinutes: number;
  ownerRole: string;
  criticality: Criticality;
  estimatedMinutes: number;
  dependsOn: string[];
  fallback?: string;
}

export interface Playbook {
  id: string;
  title: string;
  category: string;
  description: string;
  durationLabel: string;
  actions: ActionTemplate[];
}

export interface ActionInstance extends ActionTemplate {
  status: ActionStatus;
  ownerName: string;
  statusNote?: string;
  fallbackUsed?: boolean;
  /** Person or team the action is waiting on (only meaningful when status is "waiting"). */
  waitingOn?: string;
}

export type ActionUpdate = Partial<
  Pick<ActionInstance, "status" | "statusNote" | "fallbackUsed" | "waitingOn">
>;

export interface Activity {
  id: string;
  title: string;
  playbookId: string;
  startsAt: string;
  coordinator: string;
  location: string;
  completedAt?: string;
  reviewNote?: string;
  actions: ActionInstance[];
}

export interface RecoveryGroup {
  id: "must-do-now" | "can-simplify" | "follow-up" | "blocked";
  title: string;
  description: string;
  actions: ActionInstance[];
  /** Why each action landed in this group, keyed by action id. */
  explanations: Record<string, string>;
}

export type ReadinessReasonKind =
  | "start-passed"
  | "blocked"
  | "deadline-passed"
  | "waiting-near-deadline"
  | "insufficient-time"
  | "dependency-risk"
  | "waiting"
  | "due-soon";

export interface ReadinessReason {
  kind: ReadinessReasonKind;
  /** "risk" reasons make an activity At risk; "attention" reasons only flag it for follow-up. */
  severity: "risk" | "attention";
  message: string;
  actionId?: string;
}

export interface Readiness {
  status: ActivityStatus;
  label: string;
  unresolvedEssential: ActionInstance[];
  reasons: ReadinessReason[];
}
