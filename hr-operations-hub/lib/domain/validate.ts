/**
 * Validation of stored v3 data. `parseStoreV3` is used before any stored data is trusted: it checks the
 * shape (§4.2, §4.4) and the model invariants. Anything that fails is treated as unreadable.
 */
import { isClosed, isTaskResolved, occurrenceId } from "./occurrence";
import { parsePeriodKey } from "../calendar/periods";
import { calendarProblems } from "../calendar/work-calendar";
import { scheduleProblems } from "../schedule/rules";
import {
  AREA_CODES,
  COUNTERPARTY_KINDS,
  CRITICALITIES,
  HISTORY_EVENT_KINDS,
  OCCURRENCE_STATUSES,
  OFFSET_UNITS,
  OPERATION_STATUSES,
  TASK_STATUSES,
  type Assignee,
  type Schedule,
  type StoreV3,
  type Unassigned,
} from "./types";

type Rec = Record<string, unknown>;

const isRecord = (value: unknown): value is Rec => typeof value === "object" && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === "string";
const isNonEmpty = (value: unknown): value is string => isString(value) && value.trim().length > 0;
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isBoolean = (value: unknown): value is boolean => typeof value === "boolean";
const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T => isString(value) && (values as readonly string[]).includes(value);
const isInstant = (value: unknown): value is string => isString(value) && /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(new Date(value).getTime());
const isIsoDate = (value: unknown): value is string => isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value: unknown): value is string => isString(value) && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const optional = (value: unknown, check: (value: unknown) => boolean) => value === undefined || check(value);
const isArrayOf = (value: unknown, check: (item: unknown) => boolean) => Array.isArray(value) && value.every(check);
const isStringArray = (value: unknown) => isArrayOf(value, isString);

function isAssignee(value: unknown): value is Assignee {
  if (!isRecord(value)) return false;
  if (value.kind === "person") return isNonEmpty(value.personId);
  if (value.kind === "counterparty") return isNonEmpty(value.counterpartyId);
  return false;
}

function isResponsible(value: unknown): value is Assignee | Unassigned {
  return isAssignee(value) || (isRecord(value) && value.kind === "unassigned");
}

function isRoleRef(value: unknown): boolean {
  return isResponsible(value) || (isRecord(value) && (value.kind === "owner" || value.kind === "backup"));
}

const isOffset = (value: unknown) => isRecord(value) && isNumber(value.amount) && isOneOf(OFFSET_UNITS, value.unit);
const isWindow = (value: unknown) => isOffset(value) && isRecord(value) && (value.amount as number) >= 0;
const isIndependence = (value: unknown) => isRecord(value) && isStringArray(value.of) && isBoolean(value.selfCheckFallback);

function isPerson(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmpty(value.id) &&
    isNonEmpty(value.name) &&
    isString(value.roleTitle) &&
    isArrayOf(value.unavailable, (item) => isRecord(item) && isNonEmpty(item.id) && isIsoDate(item.from) && isIsoDate(item.to))
  );
}

function isCounterparty(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmpty(value.id) &&
    isNonEmpty(value.name) &&
    isOneOf(COUNTERPARTY_KINDS, value.kind) &&
    optional(value.contactName, isString)
  );
}

function isTaskTemplate(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmpty(value.id) &&
    isNonEmpty(value.title) &&
    isString(value.description) &&
    isOffset(value.offset) &&
    optional(value.dueTime, isTime) &&
    isString(value.ownerRole) &&
    isRoleRef(value.responsible) &&
    optional(value.contributors, (item) => isArrayOf(item, isAssignee)) &&
    isOneOf(CRITICALITIES, value.criticality) &&
    isNumber(value.estimatedMinutes) &&
    isStringArray(value.dependsOn) &&
    optional(value.fallback, isString) &&
    optional(value.independence, isIndependence)
  );
}

function isPlaybook(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmpty(value.id) &&
    isNumber(value.version) &&
    isNonEmpty(value.title) &&
    isOneOf(AREA_CODES, value.area) &&
    (value.status === "available" || value.status === "in-design") &&
    isString(value.purpose) &&
    isString(value.trigger) &&
    (value.anchorKind === "event-start" || value.anchorKind === "deadline") &&
    isString(value.anchorLabel) &&
    isOffset(value.leadTime) &&
    isWindow(value.attentionWindow) &&
    isWindow(value.recoveryWindow) &&
    isStringArray(value.completionCriteria) &&
    isArrayOf(value.tasks, isTaskTemplate)
  );
}

const RULE_KINDS = ["dayOfMonth", "nthWorkingDay", "workingDaysBeforeMonthEnd", "weekday", "monthAndDay"] as const;

function isScheduleRule(value: unknown): boolean {
  if (!isRecord(value) || !isOneOf(RULE_KINDS, value.kind)) return false;
  switch (value.kind) {
    case "dayOfMonth":
      return isNumber(value.day);
    case "nthWorkingDay":
    case "workingDaysBeforeMonthEnd":
      return isNumber(value.n);
    case "weekday":
      return isNumber(value.weekday);
    default:
      return isNumber(value.month) && isNumber(value.day);
  }
}

function isScheduleVersion(value: unknown): boolean {
  return (
    isRecord(value) &&
    isIsoDate(value.effectiveFrom) &&
    isOneOf(["weekly", "monthly", "quarterly", "annually"] as const, value.frequency) &&
    isNumber(value.interval) &&
    isScheduleRule(value.rule) &&
    (value.anchorPeriodOffset === 0 || value.anchorPeriodOffset === 1) &&
    isTime(value.time) &&
    isOneOf(["previous-working-day", "next-working-day", "none"] as const, value.weekendShift)
  );
}

function isSchedule(value: unknown): boolean {
  return (
    isRecord(value) &&
    isOneOf(["weekly", "monthly", "quarterly", "annually"] as const, value.frequency) &&
    isNumber(value.interval) &&
    isScheduleRule(value.rule) &&
    (value.anchorPeriodOffset === 0 || value.anchorPeriodOffset === 1) &&
    isTime(value.time) &&
    isOneOf(["previous-working-day", "next-working-day", "none"] as const, value.weekendShift) &&
    isIsoDate(value.startDate) &&
    optional(value.endDate, isIsoDate) &&
    isArrayOf(value.versions, isScheduleVersion)
  );
}

function isOperation(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmpty(value.id) &&
    isNonEmpty(value.title) &&
    isOneOf(AREA_CODES, value.area) &&
    isNonEmpty(value.playbookId) &&
    isNumber(value.playbookVersion) &&
    isNonEmpty(value.ownerId) &&
    optional(value.backupId, isNonEmpty) &&
    (value.schedule === null || isSchedule(value.schedule)) &&
    isOneOf(OPERATION_STATUSES, value.status) &&
    isInstant(value.createdAt)
  );
}

function isHold(value: unknown): boolean {
  return (
    isRecord(value) &&
    (value.kind === "waiting" || value.kind === "blocked") &&
    optional(value.waitingOn, isString) &&
    optional(value.note, isString) &&
    isInstant(value.since)
  );
}

function isTask(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmpty(value.id) &&
    isNonEmpty(value.title) &&
    isString(value.description) &&
    isString(value.ownerRole) &&
    isInstant(value.dueAt) &&
    isResponsible(value.responsible) &&
    isArrayOf(value.contributors, isAssignee) &&
    isOneOf(CRITICALITIES, value.criticality) &&
    isNumber(value.estimatedMinutes) &&
    isStringArray(value.dependsOn) &&
    optional(value.fallback, isString) &&
    optional(value.independence, isIndependence) &&
    isOneOf(TASK_STATUSES, value.status) &&
    optional(value.hold, isHold) &&
    optional(value.resolvedAt, isInstant) &&
    optional(value.completionNote, isString) &&
    optional(value.fallbackUsed, isBoolean)
  );
}

function isHistoryEvent(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmpty(value.id) &&
    isInstant(value.at) &&
    isNonEmpty(value.actorId) &&
    isOneOf(HISTORY_EVENT_KINDS, value.kind) &&
    optional(value.taskId, isString) &&
    isRecord(value.detail) &&
    Object.values(value.detail).every((item) => isString(item) || isNumber(item) || isBoolean(item))
  );
}

function isCoverage(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmpty(value.id) &&
    isNonEmpty(value.absentPersonId) &&
    isNonEmpty(value.coveringPersonId) &&
    isIsoDate(value.from) &&
    isIsoDate(value.to) &&
    isInstant(value.createdAt)
  );
}

function isOccurrence(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonEmpty(value.id) &&
    isNonEmpty(value.operationId) &&
    isNonEmpty(value.periodKey) &&
    (value.anchorKind === "event-start" || value.anchorKind === "deadline") &&
    isInstant(value.anchorAt) &&
    optional(value.originalAnchorAt, isInstant) &&
    optional(value.calendarDrift, isInstant) &&
    optional(value.scheduleDrift, isInstant) &&
    isOneOf(OCCURRENCE_STATUSES, value.status) &&
    isNonEmpty(value.playbookId) &&
    isNumber(value.playbookVersion) &&
    isNonEmpty(value.ownerId) &&
    optional(value.backupId, isNonEmpty) &&
    optional(value.eventDetails, (item) => isRecord(item) && isString(item.location)) &&
    isArrayOf(value.tasks, isTask) &&
    isArrayOf(value.coverage, isCoverage) &&
    optional(value.closedAt, isInstant) &&
    optional(value.closeNote, isString) &&
    optional(value.reviewNote, isString) &&
    optional(value.playbookFeedback, isBoolean) &&
    isArrayOf(value.history, isHistoryEvent)
  );
}

function isWorkCalendar(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.timeZone === "Europe/Vienna" &&
    isArrayOf(value.workingWeek, (day) => isNumber(day) && (day as number) >= 1 && (day as number) <= 7) &&
    isRecord(value.workingHours) &&
    Object.values(value.workingHours).every((intervals) =>
      isArrayOf(intervals, (item) => isRecord(item) && isTime(item.start) && isTime(item.end)),
    ) &&
    isArrayOf(value.publicHolidays, (item) => isRecord(item) && isIsoDate(item.date) && isString(item.name) && isString(item.source) && isBoolean(item.verified)) &&
    isArrayOf(value.companyClosures, (item) => isRecord(item) && isIsoDate(item.date) && isString(item.name)) &&
    isInstant(value.updatedAt)
  );
}

/** Shape check only. Use `findInvariantViolations` for the cross-entity rules. */
export function isStoreV3Shape(value: unknown): value is StoreV3 {
  return (
    isRecord(value) &&
    value.version === 3 &&
    isInstant(value.savedAt) &&
    isBoolean(value.modified) &&
    isWorkCalendar(value.calendar) &&
    isArrayOf(value.people, isPerson) &&
    isArrayOf(value.counterparties, isCounterparty) &&
    isArrayOf(value.playbooks, isPlaybook) &&
    isArrayOf(value.operations, isOperation) &&
    isArrayOf(value.occurrences, isOccurrence)
  );
}

function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

/**
 * Cross-entity invariants of the model. Returns a list of violations; an empty list means the store is
 * consistent. These are the rules the reducer keeps; stored data that breaks them is not trusted.
 */
export function findInvariantViolations(store: StoreV3): string[] {
  const violations: string[] = [];
  const people = new Set(store.people.map((person) => person.id));
  const counterparties = new Set(store.counterparties.map((item) => item.id));
  const operations = new Map(store.operations.map((operation) => [operation.id, operation] as const));

  for (const [label, ids] of [
    ["person", store.people.map((item) => item.id)],
    ["counterparty", store.counterparties.map((item) => item.id)],
    ["playbook", store.playbooks.map((item) => `${item.id}@${item.version}`)],
    ["operation", store.operations.map((item) => item.id)],
    ["occurrence", store.occurrences.map((item) => item.id)],
  ] as const) {
    for (const id of duplicates([...ids])) violations.push(`duplicate ${label} id ${id}`);
  }

  const assigneeKnown = (assignee: Assignee | Unassigned) =>
    assignee.kind === "unassigned" ||
    (assignee.kind === "person" ? people.has(assignee.personId) : counterparties.has(assignee.counterpartyId));

  for (const playbook of store.playbooks) {
    const taskIds = new Set(playbook.tasks.map((task) => task.id));
    for (const task of playbook.tasks) {
      if (task.criticality === "essential" && task.responsible.kind === "unassigned") violations.push(`playbook ${playbook.id}: essential task ${task.id} unassigned`);
      for (const dependency of task.dependsOn) if (!taskIds.has(dependency)) violations.push(`playbook ${playbook.id}: ${task.id} depends on unknown ${dependency}`);
    }
  }

  for (const problem of calendarProblems(store.calendar)) violations.push(`calendar: ${problem}`);

  for (const operation of store.operations) {
    if (operation.schedule) for (const problem of scheduleProblems(operation.schedule)) violations.push(`operation ${operation.id}: schedule ${problem}`);
    if (!people.has(operation.ownerId)) violations.push(`operation ${operation.id}: owner is not a person`);
    if (operation.backupId !== undefined && !people.has(operation.backupId)) violations.push(`operation ${operation.id}: backup is not a person`);
    if (operation.backupId !== undefined && operation.backupId === operation.ownerId) violations.push(`operation ${operation.id}: backup equals owner`);
    if (!store.playbooks.some((playbook) => playbook.id === operation.playbookId && playbook.version === operation.playbookVersion)) {
      violations.push(`operation ${operation.id}: unknown playbook ${operation.playbookId} v${operation.playbookVersion}`);
    }
  }

  for (const occurrence of store.occurrences) {
    const where = `occurrence ${occurrence.id}`;
    const operation = operations.get(occurrence.operationId);
    if (!operation) violations.push(`${where}: unknown operation`);
    if (occurrence.id !== occurrenceId(occurrence.operationId, occurrence.periodKey)) violations.push(`${where}: id is not operationId:periodKey`);
    if (operation && operation.schedule === null && occurrence.periodKey !== "once") violations.push(`${where}: one-off occurrence must use period "once"`);
    if (operation?.schedule && !parsePeriodKey(occurrence.periodKey, (operation.schedule as Schedule).frequency)) {
      violations.push(`${where}: period key does not match the ${operation.schedule.frequency} schedule`);
    }
    if (isClosed(occurrence) && (occurrence.calendarDrift || occurrence.scheduleDrift)) violations.push(`${where}: closed occurrence with a drift suggestion`);
    if (!people.has(occurrence.ownerId)) violations.push(`${where}: owner is not a person`);
    if (occurrence.backupId !== undefined && occurrence.backupId === occurrence.ownerId) violations.push(`${where}: backup equals owner`);
    if (occurrence.anchorKind === "event-start" && !occurrence.eventDetails) violations.push(`${where}: event occurrence without eventDetails`);
    if (isClosed(occurrence) && !occurrence.closedAt) violations.push(`${where}: closed without closedAt`);
    if (!isClosed(occurrence) && occurrence.closedAt) violations.push(`${where}: open with closedAt`);
    if (["missed", "skipped", "cancelled"].includes(occurrence.status) && !occurrence.closeNote?.trim()) violations.push(`${where}: ${occurrence.status} without note`);
    if (occurrence.history.length === 0) violations.push(`${where}: empty history`);
    for (const id of duplicates(occurrence.history.map((event) => event.id))) violations.push(`${where}: duplicate history id ${id}`);

    const taskIds = new Set(occurrence.tasks.map((task) => task.id));
    for (const id of duplicates(occurrence.tasks.map((task) => task.id))) violations.push(`${where}: duplicate task id ${id}`);
    for (const task of occurrence.tasks) {
      const at = `${where} task ${task.id}`;
      if (task.criticality === "essential" && task.responsible.kind === "unassigned") violations.push(`${at}: essential task unassigned`);
      if (!assigneeKnown(task.responsible)) violations.push(`${at}: unknown responsible`);
      if (!task.contributors.every(assigneeKnown)) violations.push(`${at}: unknown contributor`);
      if (isTaskResolved(task) !== (task.resolvedAt !== undefined)) violations.push(`${at}: resolvedAt must be set exactly when done or skipped`);
      const onHold = task.status === "waiting" || task.status === "blocked";
      if (onHold !== (task.hold !== undefined)) violations.push(`${at}: hold must be set exactly when waiting or blocked`);
      if (task.hold && task.hold.kind !== task.status) violations.push(`${at}: hold kind differs from status`);
      for (const dependency of task.dependsOn) if (!taskIds.has(dependency)) violations.push(`${at}: depends on unknown ${dependency}`);
    }
  }
  return violations;
}

/** The store, when the value is a well-formed and consistent v3 store; otherwise null. */
export function parseStoreV3(value: unknown): StoreV3 | null {
  if (!isStoreV3Shape(value)) return null;
  return findInvariantViolations(value).length === 0 ? value : null;
}
