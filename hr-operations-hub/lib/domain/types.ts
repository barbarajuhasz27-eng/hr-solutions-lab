/**
 * Domain model v3 (OPERATIONS_SPEC.md §4.2). Field names and semantics are binding.
 *
 * - An Operation is a responsibility, not an execution.
 * - An Occurrence is one execution, with its own snapshot of tasks, owner, backup and playbook version.
 * - Tasks belong to occurrences. `dueAt` is resolved and stored on each task.
 *
 * Types that later milestones need (Coverage, independence) are defined here so those milestones can
 * implement their workflows without redesigning the model. Schedules and the work calendar are evaluated by
 * the M2 engine (lib/calendar, lib/schedule).
 */

/** Local calendar date in Europe/Vienna, "2026-11-23". */
export type ISODate = string;
/** UTC instant, "2026-11-23T11:00:00.000Z". */
export type ISODateTime = string;

/** The ten operational areas (§2). */
export const AREA_CODES = ["LC", "PC", "TB", "DA", "SD", "TP", "LD", "RW", "PG", "CE"] as const;
export type AreaCode = (typeof AREA_CODES)[number];

export interface Person {
  id: string;
  name: string;
  roleTitle: string;
  /** All-day, inclusive. No reason is collected or stored (§5.4). */
  unavailable: { id: string; from: ISODate; to: ISODate }[];
}

export const COUNTERPARTY_KINDS = ["internal-team", "external-provider", "manager-group"] as const;
export interface Counterparty {
  id: string;
  name: string;
  kind: (typeof COUNTERPARTY_KINDS)[number];
  contactName?: string;
}

export type Assignee =
  | { kind: "person"; personId: string }
  | { kind: "counterparty"; counterpartyId: string };

export type Unassigned = { kind: "unassigned" };

/** Used in templates only. `unassigned` is allowed for non-essential tasks only (§5.1). */
export type RoleRef = { kind: "owner" } | { kind: "backup" } | Assignee | Unassigned;

export const OFFSET_UNITS = ["workingDays", "calendarDays", "hours", "minutes"] as const;
export type OffsetUnit = (typeof OFFSET_UNITS)[number];
export type Offset = { amount: number; unit: OffsetUnit };
/** Same shape as Offset, amount >= 0. */
export type Window = Offset;

export const CRITICALITIES = ["essential", "important", "optional"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export interface Independence {
  /** TaskTemplate ids whose effective responsible must be a different person (§5.5). */
  of: string[];
  /** true: the fallback is a documented self-check exception. */
  selfCheckFallback: boolean;
}

export interface TaskTemplate {
  id: string;
  title: string;
  description: string;
  /** Relative to the occurrence anchor; negative = before. */
  offset: Offset;
  /** "HH:mm" local, for day-based offsets; default = anchor time. */
  dueTime?: string;
  ownerRole: string;
  responsible: RoleRef;
  contributors?: Assignee[];
  criticality: Criticality;
  /** Effort, not lead time. */
  estimatedMinutes: number;
  dependsOn: string[];
  fallback?: string;
  independence?: Independence;
}

export type AnchorKind = "event-start" | "deadline";

export interface Playbook {
  id: string;
  version: number;
  title: string;
  area: AreaCode;
  status: "available" | "in-design";
  purpose: string;
  trigger: string;
  anchorKind: AnchorKind;
  anchorLabel: string;
  leadTime: Offset;
  attentionWindow: Window;
  recoveryWindow: Window;
  completionCriteria: string[];
  tasks: TaskTemplate[];
}

export const OPERATION_STATUSES = ["active", "paused", "retired"] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export interface Operation {
  id: string;
  title: string;
  area: AreaCode;
  playbookId: string;
  /** Used for newly generated occurrences. */
  playbookVersion: number;
  /** Accountable owner, always a Person. */
  ownerId: string;
  /** A Person, different from the owner. */
  backupId?: string;
  /** null = one-off. */
  schedule: Schedule | null;
  status: OperationStatus;
  createdAt: ISODateTime;
}

export type ISOWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ScheduleRule =
  | { kind: "dayOfMonth"; day: number }
  | { kind: "nthWorkingDay"; n: number }
  | { kind: "workingDaysBeforeMonthEnd"; n: number }
  | { kind: "weekday"; weekday: ISOWeekday }
  | { kind: "monthAndDay"; month: number; day: number };

export type ScheduleFrequency = "weekly" | "monthly" | "quarterly" | "annually";
export type WeekendShift = "previous-working-day" | "next-working-day" | "none";

/**
 * One entry in a schedule's change history (§6.6). `versions` lists them by `effectiveFrom`; the
 * top-level fields of `Schedule` always equal the newest version. An empty list means the top-level
 * fields have applied since `startDate`.
 */
export interface ScheduleVersion {
  effectiveFrom: ISODate;
  frequency: ScheduleFrequency;
  interval: number;
  rule: ScheduleRule;
  anchorPeriodOffset: 0 | 1;
  time: string;
  weekendShift: WeekendShift;
}

export interface Schedule {
  frequency: ScheduleFrequency;
  interval: number;
  rule: ScheduleRule;
  /** 1 = the anchor falls in the period after the one the work covers; periodKey stays the covered period. */
  anchorPeriodOffset: 0 | 1;
  /** "HH:mm" local. */
  time: string;
  weekendShift: WeekendShift;
  startDate: ISODate;
  endDate?: ISODate;
  versions: ScheduleVersion[];
}

export const OCCURRENCE_STATUSES = [
  "scheduled",
  "active",
  "completed",
  "completed-late",
  "missed",
  "skipped",
  "cancelled",
] as const;
export type OccurrenceStatus = (typeof OCCURRENCE_STATUSES)[number];

/** Statuses after which an occurrence is read-only (§6.5). */
export const CLOSED_OCCURRENCE_STATUSES: readonly OccurrenceStatus[] = [
  "completed",
  "completed-late",
  "missed",
  "skipped",
  "cancelled",
];

export const TASK_STATUSES = ["not-started", "in-progress", "waiting", "blocked", "done", "skipped"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type HoldKind = "waiting" | "blocked";
export interface Hold {
  kind: HoldKind;
  waitingOn?: string;
  note?: string;
  since: ISODateTime;
}

export interface Task {
  /** = template id. */
  id: string;
  title: string;
  description: string;
  ownerRole: string;
  /** Resolved at generation, recalculated only per §6.5–6.7. */
  dueAt: ISODateTime;
  responsible: Assignee | Unassigned;
  contributors: Assignee[];
  criticality: Criticality;
  estimatedMinutes: number;
  dependsOn: string[];
  fallback?: string;
  /** Snapshot of the template (§5.5). */
  independence?: Independence;
  status: TaskStatus;
  hold?: Hold;
  /** Set when status becomes done or skipped, cleared on reopen. A skipped essential task is never a completed one. */
  resolvedAt?: ISODateTime;
  /** Privacy-safe aggregated status only (§4.5). */
  completionNote?: string;
  fallbackUsed?: boolean;
}

export interface Coverage {
  id: string;
  absentPersonId: string;
  coveringPersonId: string;
  /** Inclusive. */
  from: ISODate;
  to: ISODate;
  createdAt: ISODateTime;
}

export const HISTORY_EVENT_KINDS = [
  "generated",
  "activated",
  "task-completed",
  "task-reopened",
  "hold-set",
  "hold-released",
  "fallback-used",
  "task-reassigned",
  "coverage-added",
  "coverage-removed",
  "moved",
  "skipped",
  "closed",
  "recovery-decision",
  "calendar-drift-applied",
  "migrated",
  // M2: a calendar or schedule drift suggestion was reviewed and the current anchor kept (§6.6, §6.7).
  "drift-kept",
] as const;
export type HistoryEventKind = (typeof HISTORY_EVENT_KINDS)[number];

export type HistoryDetail = Record<string, string | number | boolean>;

export interface HistoryEvent {
  id: string;
  at: ISODateTime;
  /** The simulated current user. */
  actorId: string;
  kind: HistoryEventKind;
  taskId?: string;
  /** Structured; rendered via the message catalogue. */
  detail: HistoryDetail;
}

export interface Occurrence {
  /** `${operationId}:${periodKey}` */
  id: string;
  operationId: string;
  /** "2026-11", "2026-W45", "2026-Q4", "2026", or "once". */
  periodKey: string;
  anchorKind: AnchorKind;
  anchorAt: ISODateTime;
  /** Set when moved manually. */
  originalAnchorAt?: ISODateTime;
  /** The rule now yields a different date after a work-calendar change (§6.7). */
  calendarDrift?: ISODateTime;
  /**
   * The new schedule version yields a different date for this started occurrence (§6.6: "Schedule changed:
   * new rule gives DD.MM.YYYY"). Not in the §4.2 listing; added in M2 so the suggestion can be stored,
   * applied or kept like `calendarDrift`.
   */
  scheduleDrift?: ISODateTime;
  status: OccurrenceStatus;
  playbookId: string;
  playbookVersion: number;
  /** Snapshot of the operation owner at generation. */
  ownerId: string;
  backupId?: string;
  /** Event-start occurrences only. */
  eventDetails?: { location: string };
  tasks: Task[];
  coverage: Coverage[];
  closedAt?: ISODateTime;
  /** Required for missed, skipped and cancelled. */
  closeNote?: string;
  reviewNote?: string;
  playbookFeedback?: boolean;
  history: HistoryEvent[];
}

export interface PublicHoliday {
  date: ISODate;
  name: string;
  source: string;
  /** false until someone has checked it against the source. */
  verified: boolean;
}

export interface WorkCalendar {
  timeZone: "Europe/Vienna";
  workingWeek: ISOWeekday[];
  /** "HH:mm" local; ordered, non-overlapping intervals per weekday. Breaks are gaps. */
  workingHours: Partial<Record<ISOWeekday, { start: string; end: string }[]>>;
  publicHolidays: PublicHoliday[];
  /** Company-specific full-day non-working days. Never statutory public holidays. */
  companyClosures: { date: ISODate; name: string }[];
  updatedAt: ISODateTime;
}

export const STORE_VERSION = 3;

export interface StoreV3 {
  version: 3;
  savedAt: ISODateTime;
  modified: boolean;
  calendar: WorkCalendar;
  people: Person[];
  counterparties: Counterparty[];
  /** Read-only in the MVP, shipped with the app; stored for version history. */
  playbooks: Playbook[];
  operations: Operation[];
  occurrences: Occurrence[];
}
