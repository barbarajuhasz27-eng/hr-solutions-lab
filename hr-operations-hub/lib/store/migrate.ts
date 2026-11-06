/**
 * Migration of v1/v2 demo data into the v3 store (§11.2, §11.3). Pure: `now` is passed in.
 *
 * Each v2 activity becomes a one-off Operation (area LD, playbook `training-session` v2) plus one
 * Occurrence (`periodKey: "once"`). Statuses, holds, notes, waiting-on details, fallback usage, original
 * dates and the relative due offsets are preserved.
 */
import { responsibleForLegacyRole, TRAINING_PLAYBOOK_ID, TRAINING_PLAYBOOK_VERSION } from "../domain/playbooks";
import {
  addMinutes,
  findPlaybook,
  ONE_OFF_PERIOD_KEY,
  occurrenceId,
  openStatusAt,
  resolveRole,
} from "../domain/occurrence";
import { createSeedStore, CURRENT_USER_ID, SEED_TRAINING_OPERATION_IDS } from "../domain/seed";
import type { ISODateTime, Occurrence, Operation, StoreV3, Task } from "../domain/types";
import { TASK_STATUSES } from "../domain/types";
import { formatDuration } from "../format";
import { message } from "../messages/en";
import type { Activity, ActionInstance } from "../model";
import type { LoadedDemo } from "../storage";

export interface MigrationContext {
  /** Migration time: the `migrated` history event and the new operations' `createdAt`. */
  now: ISODateTime;
  /** When the v2 data was last known to be current (on the possibly shifted timeline). */
  savedAt: ISODateTime;
  fromVersion: 1 | 2;
  store: Pick<StoreV3, "people" | "playbooks" | "calendar">;
}

/** "activity-training-rescue" → "op-training-rescue"; any other ID gets an "op-" prefix. */
export function operationIdForActivity(activityId: string): string {
  return activityId.startsWith("activity-") ? `op-${activityId.slice("activity-".length)}` : `op-${activityId}`;
}

function ownerIdFor(coordinator: string | undefined, people: StoreV3["people"]): string {
  const name = coordinator?.trim().toLowerCase();
  return people.find((person) => person.name.toLowerCase() === name)?.id ?? CURRENT_USER_ID;
}

const nonEmpty = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

function migrateAction(action: ActionInstance, activity: Activity, ownerId: string, resolvedBound: ISODateTime, savedAt: ISODateTime): Task {
  const anchorAt = new Date(activity.startsAt).toISOString();
  const status = (TASK_STATUSES as readonly string[]).includes(action.status) ? action.status : "not-started";
  const note = nonEmpty(action.statusNote);
  const responsible = resolveRole(responsibleForLegacyRole(action.ownerRole ?? ""), ownerId, undefined);
  const task: Task = {
    id: action.id,
    title: action.title,
    description: action.description ?? "",
    ownerRole: action.ownerRole ?? "HR",
    // The relative due offset is kept exactly: dueAt = anchor + dueOffsetMinutes.
    dueAt: addMinutes(anchorAt, action.dueOffsetMinutes),
    responsible,
    contributors: [],
    criticality: action.criticality,
    estimatedMinutes: action.estimatedMinutes,
    dependsOn: [...action.dependsOn],
    ...(action.fallback ? { fallback: action.fallback } : {}),
    status,
  };
  if (status === "waiting" || status === "blocked") {
    const waitingOn = status === "waiting" ? nonEmpty(action.waitingOn) : undefined;
    task.hold = { kind: status, ...(waitingOn ? { waitingOn } : {}), ...(note ? { note } : {}), since: savedAt };
  } else {
    if (note) task.completionNote = note;
    if (status === "done" || status === "skipped") {
      // v2 did not record when a step was done. The latest moment it is known to have been done is used.
      task.resolvedAt = resolvedBound;
    }
  }
  if (action.fallbackUsed) task.fallbackUsed = true;
  return task;
}

/** One v2 activity → one one-off Operation and its Occurrence (§11.3). */
export function migrateActivity(activity: Activity, operationId: string, ctx: MigrationContext): { operation: Operation; occurrence: Occurrence } {
  const playbook = findPlaybook(ctx.store, TRAINING_PLAYBOOK_ID, TRAINING_PLAYBOOK_VERSION);
  if (!playbook) throw new Error("The training-session v2 playbook is missing from the store.");
  const ownerId = ownerIdFor(activity.coordinator, ctx.store.people);
  const anchorAt = new Date(activity.startsAt).toISOString();
  const closedAt = activity.completedAt ? new Date(activity.completedAt).toISOString() : undefined;
  const resolvedBound = closedAt && closedAt < ctx.savedAt ? closedAt : ctx.savedAt;
  const tasks = activity.actions.map((action) => migrateAction(action, activity, ownerId, resolvedBound, ctx.savedAt));
  const id = occurrenceId(operationId, ONE_OFF_PERIOD_KEY);

  const operation: Operation = {
    id: operationId,
    title: activity.title,
    area: "LD",
    playbookId: TRAINING_PLAYBOOK_ID,
    playbookVersion: TRAINING_PLAYBOOK_VERSION,
    ownerId,
    schedule: null,
    status: "active",
    createdAt: ctx.now,
  };
  const reviewNote = nonEmpty(activity.reviewNote);
  const occurrence: Occurrence = {
    id,
    operationId,
    periodKey: ONE_OFF_PERIOD_KEY,
    anchorKind: "event-start",
    anchorAt,
    status: closedAt ? "completed" : openStatusAt(anchorAt, playbook, tasks, ctx.now, ctx.store.calendar),
    playbookId: TRAINING_PLAYBOOK_ID,
    playbookVersion: TRAINING_PLAYBOOK_VERSION,
    ownerId,
    eventDetails: { location: activity.location ?? "" },
    tasks,
    coverage: [],
    ...(closedAt ? { closedAt } : {}),
    ...(reviewNote ? { reviewNote } : {}),
    history: [{
      id: `${id}#1`,
      at: ctx.now,
      actorId: CURRENT_USER_ID,
      kind: "migrated",
      detail: { fromVersion: ctx.fromVersion, sourceActivityId: activity.id, resolvedAtApproximate: tasks.some((task) => task.resolvedAt !== undefined) },
    }],
  };
  return { operation, occurrence };
}

export interface LegacyResolution {
  store: StoreV3;
  notice?: string;
  migrated: boolean;
}

/**
 * Steps 3 and 4 of §11.2 for an already resolved v1/v2 demo:
 * - untouched → a fresh v3 seed; nothing is lost;
 * - modified → a fresh v3 seed without its training occurrences, plus every v2 activity converted.
 * Activities with the same ID are migrated once.
 */
export function storeFromLegacy(legacy: LoadedDemo, now: ISODateTime): LegacyResolution {
  const seed = createSeedStore(now);
  if (!legacy.modified || legacy.source === "fresh") return { store: seed, migrated: false };

  const store: StoreV3 = {
    ...seed,
    modified: true,
    operations: seed.operations.filter((operation) => !SEED_TRAINING_OPERATION_IDS.includes(operation.id)),
    occurrences: seed.occurrences.filter((occurrence) => !SEED_TRAINING_OPERATION_IDS.includes(occurrence.operationId)),
  };
  const ctx: MigrationContext = {
    now,
    savedAt: new Date(legacy.savedAt).toISOString(),
    fromVersion: legacy.source === "v1" ? 1 : 2,
    store,
  };

  const usedOperationIds = new Set(store.operations.map((operation) => operation.id));
  const seenActivities = new Set<string>();
  const operations: Operation[] = [];
  const occurrences: Occurrence[] = [];
  for (const activity of legacy.activities) {
    if (seenActivities.has(activity.id)) continue;
    seenActivities.add(activity.id);
    let operationId = operationIdForActivity(activity.id);
    for (let n = 2; usedOperationIds.has(operationId); n += 1) operationId = `${operationIdForActivity(activity.id)}-${n}`;
    usedOperationIds.add(operationId);
    const migrated = migrateActivity(activity, operationId, ctx);
    operations.push(migrated.operation);
    occurrences.push(migrated.occurrence);
  }

  const timeline =
    legacy.shiftedMinutes === undefined
      ? undefined
      : legacy.source === "v1"
        ? message("notice.timeline-realigned")
        : message("notice.timeline-shifted", { duration: formatDuration(legacy.shiftedMinutes) });
  return {
    store: { ...store, operations: [...operations, ...store.operations], occurrences: [...occurrences, ...store.occurrences] },
    notice: [message("notice.migrated"), timeline, message("notice.reset-hint")].filter(Boolean).join(" "),
    migrated: true,
  };
}
