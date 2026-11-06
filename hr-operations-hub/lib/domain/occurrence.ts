/**
 * Pure helpers for occurrences and tasks. None of them read the clock: every instant is passed in.
 */
import type {
  Assignee,
  HistoryDetail,
  HistoryEvent,
  HistoryEventKind,
  ISODateTime,
  Occurrence,
  OccurrenceStatus,
  Offset,
  Operation,
  Playbook,
  RoleRef,
  StoreV3,
  Task,
  TaskTemplate,
  Unassigned,
} from "./types";
import { CLOSED_OCCURRENCE_STATUSES } from "./types";

export type DomainErrorCode =
  | "occurrence-not-found"
  | "operation-not-found"
  | "task-not-found"
  | "playbook-not-found"
  | "playbook-not-available"
  | "occurrence-closed"
  | "task-resolved"
  | "task-not-resolved"
  | "task-not-on-hold"
  | "invalid-hold"
  | "no-fallback"
  | "essential-unassigned"
  | "unknown-assignee"
  | "same-assignee"
  | "owner-not-person"
  | "backup-equals-owner"
  | "backup-required"
  | "duplicate-id"
  | "outcome-not-allowed"
  | "note-required"
  | "note-too-long"
  | "invalid-instant"
  | "offset-unit-unsupported"
  | "cancel-one-off-only"
  | "invalid-status";

/** A rejected action. `code` maps to `error.<code>` in the message catalogue. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    detail?: string,
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "DomainError";
  }
}

export const ONE_OFF_PERIOD_KEY = "once";

export function occurrenceId(operationId: string, periodKey: string): string {
  return `${operationId}:${periodKey}`;
}

export function isClosed(occurrence: Pick<Occurrence, "status">): boolean {
  return CLOSED_OCCURRENCE_STATUSES.includes(occurrence.status);
}

export function isTaskResolved(task: Pick<Task, "status">): boolean {
  return task.status === "done" || task.status === "skipped";
}

export function toInstant(value: Date | string): ISODateTime {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new DomainError("invalid-instant", String(value));
  return date.toISOString();
}

export function addMinutes(iso: ISODateTime, minutes: number): ISODateTime {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

export function minutesBetween(from: ISODateTime, to: ISODateTime): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
}

/** Offset in minutes for duration-based units. Day-based units belong to the M2 working-day engine. */
export function offsetMinutes(offset: Offset): number {
  if (offset.unit === "minutes") return offset.amount;
  if (offset.unit === "hours") return offset.amount * 60;
  throw new DomainError("offset-unit-unsupported", offset.unit);
}

/**
 * Due instant of a task template for an anchor (§6.3). `hours` and `minutes` are exact durations from the
 * anchor instant. `workingDays` and `calendarDays` need the working-day engine and are rejected until M2.
 */
export function resolveDueAt(anchorAt: ISODateTime, template: Pick<TaskTemplate, "offset">): ISODateTime {
  return addMinutes(anchorAt, offsetMinutes(template.offset));
}

/** `owner` resolves to the occurrence owner, `backup` to its backup (§5.1). */
export function resolveRole(role: RoleRef, ownerId: string, backupId: string | undefined): Assignee | Unassigned {
  if (role.kind === "owner") return { kind: "person", personId: ownerId };
  if (role.kind === "backup") return backupId ? { kind: "person", personId: backupId } : { kind: "unassigned" };
  return role;
}

/** Stable string form of an assignee, used in history `detail`: "person:p-sophie", "counterparty:cp-it", "unassigned". */
export function assigneeRef(assignee: Assignee | Unassigned): string {
  if (assignee.kind === "person") return `person:${assignee.personId}`;
  if (assignee.kind === "counterparty") return `counterparty:${assignee.counterpartyId}`;
  return "unassigned";
}

export function assigneeName(store: Pick<StoreV3, "people" | "counterparties">, assignee: Assignee | Unassigned): string {
  if (assignee.kind === "person") return store.people.find((person) => person.id === assignee.personId)?.name ?? assignee.personId;
  if (assignee.kind === "counterparty") {
    const counterparty = store.counterparties.find((item) => item.id === assignee.counterpartyId);
    return counterparty ? counterparty.contactName ?? counterparty.name : assignee.counterpartyId;
  }
  return "Unassigned";
}

export function parseAssigneeRef(ref: string): Assignee | Unassigned {
  if (ref.startsWith("person:")) return { kind: "person", personId: ref.slice("person:".length) };
  if (ref.startsWith("counterparty:")) return { kind: "counterparty", counterpartyId: ref.slice("counterparty:".length) };
  return { kind: "unassigned" };
}

export function findPlaybook(store: Pick<StoreV3, "playbooks">, id: string, version?: number): Playbook | undefined {
  const matching = store.playbooks.filter((playbook) => playbook.id === id);
  if (version === undefined) return matching.sort((a, b) => b.version - a.version)[0];
  return matching.find((playbook) => playbook.version === version);
}

/** Lead-time start: `anchor − leadTime` or the first task due date, whichever is earlier (§6.4). */
export function leadTimeStart(anchorAt: ISODateTime, playbook: Pick<Playbook, "leadTime">, tasks: Pick<Task, "dueAt">[]): ISODateTime {
  const fromLead = new Date(addMinutes(anchorAt, -offsetMinutes(playbook.leadTime))).getTime();
  const firstDue = Math.min(...tasks.map((task) => new Date(task.dueAt).getTime()));
  return new Date(Math.min(fromLead, firstDue)).toISOString();
}

/** `active` once the lead time has started, otherwise `scheduled`. */
export function openStatusAt(anchorAt: ISODateTime, playbook: Pick<Playbook, "leadTime">, tasks: Pick<Task, "dueAt">[], now: ISODateTime): OccurrenceStatus {
  return new Date(now).getTime() >= new Date(leadTimeStart(anchorAt, playbook, tasks)).getTime() ? "active" : "scheduled";
}

export function historyEvent(
  occurrence: Pick<Occurrence, "id" | "history">,
  kind: HistoryEventKind,
  at: ISODateTime,
  actorId: string,
  detail: HistoryDetail = {},
  taskId?: string,
): HistoryEvent {
  return {
    id: `${occurrence.id}#${occurrence.history.length + 1}`,
    at,
    actorId,
    kind,
    ...(taskId ? { taskId } : {}),
    detail,
  };
}

export interface InstantiateInput {
  operation: Pick<Operation, "id" | "ownerId" | "backupId">;
  playbook: Playbook;
  periodKey: string;
  anchorAt: ISODateTime;
  location?: string;
  now: ISODateTime;
  actorId: string;
}

/**
 * A new occurrence with its snapshot (§4.3): tasks with resolved `dueAt`, owner, backup and playbook version.
 * Its history starts with a single `generated` event.
 */
export function instantiateOccurrence(input: InstantiateInput): Occurrence {
  const { operation, playbook, periodKey, anchorAt, now, actorId } = input;
  const tasks: Task[] = playbook.tasks.map((template) => {
    const responsible = resolveRole(template.responsible, operation.ownerId, operation.backupId);
    if (template.criticality === "essential" && responsible.kind === "unassigned") throw new DomainError("backup-required", template.id);
    return {
      id: template.id,
      title: template.title,
      description: template.description,
      ownerRole: template.ownerRole,
      dueAt: resolveDueAt(anchorAt, template),
      responsible,
      contributors: structuredClone(template.contributors ?? []),
      criticality: template.criticality,
      estimatedMinutes: template.estimatedMinutes,
      dependsOn: [...template.dependsOn],
      ...(template.fallback ? { fallback: template.fallback } : {}),
      ...(template.independence ? { independence: structuredClone(template.independence) } : {}),
      status: "not-started",
    };
  });
  const base: Occurrence = {
    id: occurrenceId(operation.id, periodKey),
    operationId: operation.id,
    periodKey,
    anchorKind: playbook.anchorKind,
    anchorAt,
    status: openStatusAt(anchorAt, playbook, tasks, now),
    playbookId: playbook.id,
    playbookVersion: playbook.version,
    ownerId: operation.ownerId,
    ...(operation.backupId ? { backupId: operation.backupId } : {}),
    ...(playbook.anchorKind === "event-start" ? { eventDetails: { location: input.location ?? "" } } : {}),
    tasks,
    coverage: [],
    history: [],
  };
  return {
    ...base,
    history: [historyEvent(base, "generated", now, actorId, { playbookId: playbook.id, playbookVersion: playbook.version })],
  };
}

/**
 * Not started (§4.3): no task beyond `not-started`, no history except `generated`, and not closed.
 * Only such occurrences may be regenerated when the operation's owner, schedule or playbook changes.
 */
export function isNotStarted(occurrence: Occurrence): boolean {
  return (
    !isClosed(occurrence) &&
    occurrence.tasks.every((task) => task.status === "not-started") &&
    occurrence.history.every((event) => event.kind === "generated")
  );
}
