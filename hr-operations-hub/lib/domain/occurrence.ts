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
  WorkCalendar,
} from "./types";
import { CLOSED_OCCURRENCE_STATUSES } from "./types";
import { DomainError } from "./errors";
import { leadTimeStartAt, resolveDueAt as resolveTemplateDueAt } from "../schedule/offsets";
import type { WorkingDayCalendar } from "../calendar/working-days";

export { DOMAIN_ERROR_CODES, DomainError, type DomainErrorCode } from "./errors";

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

/** Offset in minutes for duration-based units only. Day-based units are calendar dates, not durations. */
export function offsetMinutes(offset: Offset): number {
  if (offset.unit === "minutes") return offset.amount;
  if (offset.unit === "hours") return offset.amount * 60;
  throw new DomainError("offset-unit-unsupported", offset.unit);
}

/**
 * Due instant of a task template for an anchor (§6.3), for every offset unit. Day-based units use the
 * working-day calendar; hours and minutes are exact durations from the anchor instant.
 */
export function resolveDueAt(anchorAt: ISODateTime, template: Pick<TaskTemplate, "offset" | "dueTime">, calendar: WorkingDayCalendar): ISODateTime {
  return resolveTemplateDueAt(anchorAt, template, calendar);
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

/** Activation instant: `anchor − leadTime` or the first task due date, whichever is earlier (§6.4). */
export function leadTimeStart(anchorAt: ISODateTime, playbook: Pick<Playbook, "leadTime">, tasks: Pick<Task, "dueAt">[], calendar: WorkingDayCalendar): ISODateTime {
  const fromLead = new Date(leadTimeStartAt(anchorAt, playbook.leadTime, calendar)).getTime();
  const firstDue = Math.min(...tasks.map((task) => new Date(task.dueAt).getTime()));
  return new Date(Math.min(fromLead, firstDue)).toISOString();
}

/** `active` once the lead time has started, otherwise `scheduled`. */
export function openStatusAt(anchorAt: ISODateTime, playbook: Pick<Playbook, "leadTime">, tasks: Pick<Task, "dueAt">[], now: ISODateTime, calendar: WorkingDayCalendar): OccurrenceStatus {
  return new Date(now).getTime() >= new Date(leadTimeStart(anchorAt, playbook, tasks, calendar)).getTime() ? "active" : "scheduled";
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
  /** Working-day calendar for day-based offsets and lead times. */
  calendar: WorkingDayCalendar | WorkCalendar;
  now: ISODateTime;
  actorId: string;
  /** Extra `detail` of the `generated` event, e.g. `{ reason: "schedule-changed" }`. */
  generatedDetail?: Occurrence["history"][number]["detail"];
}

/**
 * A new occurrence with its snapshot (§4.3): tasks with resolved `dueAt`, owner, backup and playbook version.
 * Its history starts with a single `generated` event and its status is `scheduled`.
 */
export function instantiateOccurrence(input: InstantiateInput): Occurrence {
  const { operation, playbook, periodKey, anchorAt, now, actorId, calendar } = input;
  const tasks: Task[] = playbook.tasks.map((template) => {
    const responsible = resolveRole(template.responsible, operation.ownerId, operation.backupId);
    if (template.criticality === "essential" && responsible.kind === "unassigned") throw new DomainError("backup-required", template.id);
    return {
      id: template.id,
      title: template.title,
      description: template.description,
      ownerRole: template.ownerRole,
      dueAt: resolveDueAt(anchorAt, template, calendar),
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
    // Always scheduled: activation, with its `activated` event, is a separate step (`activateIfDue`).
    status: "scheduled",
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
    history: [historyEvent(base, "generated", now, actorId, { playbookId: playbook.id, playbookVersion: playbook.version, ...input.generatedDetail })],
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

/**
 * Activation (§6.4): a `scheduled` occurrence becomes `active` once `now` reaches the earlier of
 * `anchor − leadTime` and its first task due date, with one `activated` event. Anything else is returned
 * unchanged, so repeated calls never add a second event.
 */
export function activateIfDue(
  occurrence: Occurrence,
  playbook: Pick<Playbook, "leadTime">,
  calendar: WorkingDayCalendar,
  now: ISODateTime,
  actorId: string,
): Occurrence {
  if (occurrence.status !== "scheduled") return occurrence;
  const activeFrom = leadTimeStart(occurrence.anchorAt, playbook, occurrence.tasks, calendar);
  if (new Date(now).getTime() < new Date(activeFrom).getTime()) return occurrence;
  // The event carries the moment the lead time started, but never precedes the occurrence's previous event.
  const lastAt = occurrence.history.length ? occurrence.history[occurrence.history.length - 1].at : activeFrom;
  const at = new Date(Math.max(new Date(activeFrom).getTime(), new Date(lastAt).getTime())).toISOString();
  return {
    ...occurrence,
    status: "active",
    history: [...occurrence.history, historyEvent(occurrence, "activated", at, actorId, { activeFrom })],
  };
}
