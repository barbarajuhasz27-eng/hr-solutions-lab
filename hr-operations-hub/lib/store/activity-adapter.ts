/**
 * Temporary read-only adapter (M1 → M3): presents v3 occurrences as the M0 `Activity` view model, so the
 * existing readiness engine (`lib/engine.ts`) and the M0 screens keep working unchanged on v3 data.
 *
 * The v3 store is the source of truth. Nothing here is persisted, and every change goes through the v3
 * reducer. M3 replaces the engine with the occurrence-based one, and this adapter is removed.
 */
import { assigneeName, isClosed, minutesBetween } from "../domain/occurrence";
import type { Occurrence, StoreV3, Task } from "../domain/types";
import type { ActionInstance, Activity } from "../model";

function toAction(task: Task, occurrence: Occurrence, store: StoreV3): ActionInstance {
  const statusNote = task.hold ? task.hold.note : task.completionNote;
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    dueOffsetMinutes: Math.round(minutesBetween(occurrence.anchorAt, task.dueAt)),
    ownerRole: task.ownerRole,
    criticality: task.criticality,
    estimatedMinutes: task.estimatedMinutes,
    dependsOn: [...task.dependsOn],
    ...(task.fallback ? { fallback: task.fallback } : {}),
    status: task.status,
    ownerName: assigneeName(store, task.responsible),
    ...(statusNote ? { statusNote } : {}),
    ...(task.fallbackUsed ? { fallbackUsed: true } : {}),
    ...(task.hold?.waitingOn ? { waitingOn: task.hold.waitingOn } : {}),
  };
}

export function toActivity(occurrence: Occurrence, store: StoreV3): Activity {
  const operation = store.operations.find((item) => item.id === occurrence.operationId);
  const owner = store.people.find((person) => person.id === occurrence.ownerId);
  return {
    id: occurrence.id,
    title: operation?.title ?? occurrence.id,
    playbookId: occurrence.playbookId,
    startsAt: occurrence.anchorAt,
    coordinator: owner?.name ?? occurrence.ownerId,
    location: occurrence.eventDetails?.location ?? "",
    // The M0 engine treats any closed occurrence as finished.
    ...(isClosed(occurrence) && occurrence.closedAt ? { completedAt: occurrence.closedAt } : {}),
    ...(occurrence.reviewNote ? { reviewNote: occurrence.reviewNote } : {}),
    actions: occurrence.tasks.map((task) => toAction(task, occurrence, store)),
  };
}

/** Every occurrence as an M0 activity, in store order (newest created first). */
export function toActivities(store: StoreV3): Activity[] {
  return store.occurrences.map((occurrence) => toActivity(occurrence, store));
}
