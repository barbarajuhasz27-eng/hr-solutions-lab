/**
 * The v3 store reducer (§4.4). All changes go through named actions.
 *
 * - Deterministic and pure: `now` and the simulated actor are passed in `ActionContext`; nothing reads the
 *   clock, and the previous state is never mutated.
 * - Every action that changes an occurrence appends a `HistoryEvent` with `actorId`, `at`, `kind` and a
 *   structured `detail`.
 * - Invalid actions throw a `DomainError`; the caller keeps the previous state.
 *
 * Deferred: coverage and hand-over, the independence guard and recovery decisions (M4/M8), schedule and
 * calendar updates and activation (M2). Their types exist in `types.ts`.
 */
import {
  assigneeRef,
  DomainError,
  findPlaybook,
  historyEvent,
  instantiateOccurrence,
  isClosed,
  isNotStarted,
  isTaskResolved,
  minutesBetween,
  addMinutes,
  occurrenceId as buildOccurrenceId,
  ONE_OFF_PERIOD_KEY,
  resolveDueAt,
  toInstant,
} from "./occurrence";
import { message } from "../messages/en";
import { closeOptions, outcomeRequiresNote, assessOutcome, type CloseOutcome } from "./outcome";
import type {
  Assignee,
  HistoryDetail,
  HistoryEventKind,
  HoldKind,
  ISODateTime,
  Occurrence,
  Operation,
  OperationStatus,
  StoreV3,
  Task,
  Unassigned,
} from "./types";

export const WAITING_ON_MAX_LENGTH = 60;
export const HOLD_NOTE_MAX_LENGTH = 160;
/** Skip reasons, for tasks and occurrences (§6.5). */
export const SKIP_REASON_MAX_LENGTH = 160;

export interface ActionContext {
  now: ISODateTime;
  /** The simulated current user. */
  actorId: string;
}

export interface HoldInput {
  kind: HoldKind;
  waitingOn?: string;
  note?: string;
}

export type HubAction =
  | { type: "completeTask"; occurrenceId: string; taskId: string; note?: string }
  | { type: "skipTask"; occurrenceId: string; taskId: string; reason: string }
  | { type: "reopenTask"; occurrenceId: string; taskId: string }
  | { type: "setHold"; occurrenceId: string; taskId: string; hold: HoldInput }
  | { type: "releaseHold"; occurrenceId: string; taskId: string }
  | { type: "useFallback"; occurrenceId: string; taskId: string; note?: string }
  | { type: "reassignTask"; occurrenceId: string; taskId: string; responsible: Assignee | Unassigned }
  | { type: "moveOccurrence"; occurrenceId: string; anchorAt: ISODateTime }
  | { type: "skipOccurrence"; occurrenceId: string; reason: string }
  | {
      type: "closeOccurrence";
      occurrenceId: string;
      outcome: CloseOutcome;
      note?: string;
      reviewNote?: string;
      playbookFeedback?: boolean;
    }
  | {
      type: "createOperation";
      /** One-off operations only in M1; recurring operations need the M2 schedule engine. */
      operation: { id: string; title: string; playbookId: string; ownerId: string; backupId?: string };
      anchorAt: ISODateTime;
      location?: string;
    }
  | { type: "updateOwnership"; operationId: string; ownerId: string; backupId?: string }
  | { type: "setOperationStatus"; operationId: string; status: OperationStatus };

export type HubActionType = HubAction["type"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOccurrence(state: StoreV3, id: string): Occurrence {
  const occurrence = state.occurrences.find((item) => item.id === id);
  if (!occurrence) throw new DomainError("occurrence-not-found", id);
  return occurrence;
}

function getOpenOccurrence(state: StoreV3, id: string): Occurrence {
  const occurrence = getOccurrence(state, id);
  if (isClosed(occurrence)) throw new DomainError("occurrence-closed", id);
  return occurrence;
}

function getTask(occurrence: Occurrence, taskId: string): Task {
  const task = occurrence.tasks.find((item) => item.id === taskId);
  if (!task) throw new DomainError("task-not-found", taskId);
  return task;
}

function getOperation(state: StoreV3, id: string): Operation {
  const operation = state.operations.find((item) => item.id === id);
  if (!operation) throw new DomainError("operation-not-found", id);
  return operation;
}

function trimmed(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function requireNote(value: string | undefined, max?: number): string {
  const text = trimmed(value);
  if (!text) throw new DomainError("note-required");
  if (max !== undefined && text.length > max) throw new DomainError("note-too-long", String(max));
  return text;
}

function optionalNote(value: string | undefined, max: number): string | undefined {
  const text = trimmed(value);
  if (text && text.length > max) throw new DomainError("note-too-long", String(max));
  return text;
}

function assertAssigneeExists(state: StoreV3, assignee: Assignee | Unassigned): void {
  if (assignee.kind === "person" && !state.people.some((person) => person.id === assignee.personId)) {
    throw new DomainError("unknown-assignee", assignee.personId);
  }
  if (assignee.kind === "counterparty" && !state.counterparties.some((item) => item.id === assignee.counterpartyId)) {
    throw new DomainError("unknown-assignee", assignee.counterpartyId);
  }
}

function assertOwnership(state: StoreV3, ownerId: string, backupId: string | undefined): void {
  if (!state.people.some((person) => person.id === ownerId)) throw new DomainError("owner-not-person", ownerId);
  if (backupId !== undefined) {
    if (!state.people.some((person) => person.id === backupId)) throw new DomainError("unknown-assignee", backupId);
    if (backupId === ownerId) throw new DomainError("backup-equals-owner");
  }
}

function replaceOccurrence(state: StoreV3, next: Occurrence): StoreV3 {
  return {
    ...state,
    modified: true,
    occurrences: state.occurrences.map((item) => (item.id === next.id ? next : item)),
  };
}

/** Applies `change` to one task, appends one history event and returns the new store. */
function changeTask(
  state: StoreV3,
  occurrence: Occurrence,
  taskId: string,
  change: (task: Task) => Task,
  event: { kind: HistoryEventKind; detail?: HistoryDetail },
  ctx: ActionContext,
): StoreV3 {
  const tasks = occurrence.tasks.map((task) => (task.id === taskId ? change(task) : task));
  return replaceOccurrence(state, {
    ...occurrence,
    tasks,
    history: [...occurrence.history, historyEvent(occurrence, event.kind, ctx.now, ctx.actorId, event.detail ?? {}, taskId)],
  });
}

/** A task without hold, resolution or completion fields. */
function openTask(task: Task, status: Task["status"]): Task {
  const { hold: _hold, resolvedAt: _resolvedAt, completionNote: _note, fallbackUsed: _fallback, ...rest } = task;
  void _hold;
  void _resolvedAt;
  void _note;
  void _fallback;
  return { ...rest, status };
}

function resolvedTask(task: Task, status: "done" | "skipped", now: ISODateTime, note: string | undefined, fallbackUsed: boolean): Task {
  return {
    ...openTask(task, status),
    resolvedAt: now,
    ...(note ? { completionNote: note } : {}),
    ...(fallbackUsed ? { fallbackUsed: true } : {}),
  };
}

export function validateHoldInput(input: HoldInput): boolean {
  const who = input.waitingOn?.trim() ?? "";
  const note = input.note?.trim() ?? "";
  if (input.kind !== "waiting" && input.kind !== "blocked") return false;
  if (input.kind === "waiting" && !who) return false;
  if (input.kind === "blocked" && !note) return false;
  return who.length <= WAITING_ON_MAX_LENGTH && note.length <= HOLD_NOTE_MAX_LENGTH;
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function applyAction(state: StoreV3, action: HubAction, ctx: ActionContext): StoreV3 {
  const now = toInstant(ctx.now);
  const context: ActionContext = { now, actorId: ctx.actorId };

  switch (action.type) {
    case "completeTask": {
      const occurrence = getOpenOccurrence(state, action.occurrenceId);
      const task = getTask(occurrence, action.taskId);
      if (isTaskResolved(task)) throw new DomainError("task-resolved", task.id);
      const note = optionalNote(action.note, HOLD_NOTE_MAX_LENGTH);
      return changeTask(state, occurrence, task.id, (current) => resolvedTask(current, "done", now, note, false), {
        kind: "task-completed",
        detail: { previousStatus: task.status, responsible: assigneeRef(task.responsible) },
      }, context);
    }

    case "skipTask": {
      const occurrence = getOpenOccurrence(state, action.occurrenceId);
      const task = getTask(occurrence, action.taskId);
      if (isTaskResolved(task)) throw new DomainError("task-resolved", task.id);
      const reason = requireNote(action.reason, SKIP_REASON_MAX_LENGTH);
      // A task skip uses the `skipped` kind with a `taskId`; an occurrence skip has none.
      return changeTask(state, occurrence, task.id, (current) => resolvedTask(current, "skipped", now, reason, false), {
        kind: "skipped",
        detail: { previousStatus: task.status, criticality: task.criticality },
      }, context);
    }

    case "reopenTask": {
      const occurrence = getOpenOccurrence(state, action.occurrenceId);
      const task = getTask(occurrence, action.taskId);
      if (!isTaskResolved(task)) throw new DomainError("task-not-resolved", task.id);
      return changeTask(state, occurrence, task.id, (current) => openTask(current, "not-started"), {
        kind: "task-reopened",
        detail: { previousStatus: task.status, ...(task.fallbackUsed ? { fallbackWasUsed: true } : {}) },
      }, context);
    }

    case "setHold": {
      const occurrence = getOpenOccurrence(state, action.occurrenceId);
      const task = getTask(occurrence, action.taskId);
      if (isTaskResolved(task)) throw new DomainError("task-resolved", task.id);
      if (!validateHoldInput(action.hold)) throw new DomainError("invalid-hold");
      const kind = action.hold.kind;
      const waitingOn = kind === "waiting" ? trimmed(action.hold.waitingOn) : undefined;
      const note = trimmed(action.hold.note);
      // Editing a hold of the same kind keeps when it started; a new or changed hold starts now.
      const since = task.hold?.kind === kind ? task.hold.since : now;
      return changeTask(state, occurrence, task.id, (current) => ({
        ...openTask(current, kind),
        hold: { kind, ...(waitingOn ? { waitingOn } : {}), ...(note ? { note } : {}), since },
      }), {
        kind: "hold-set",
        detail: { holdKind: kind, ...(waitingOn ? { waitingOn } : {}), previousStatus: task.status },
      }, context);
    }

    case "releaseHold": {
      const occurrence = getOpenOccurrence(state, action.occurrenceId);
      const task = getTask(occurrence, action.taskId);
      if (!task.hold) throw new DomainError("task-not-on-hold", task.id);
      const heldMinutes = Math.max(0, Math.round(minutesBetween(task.hold.since, now)));
      return changeTask(state, occurrence, task.id, (current) => openTask(current, "not-started"), {
        kind: "hold-released",
        detail: { holdKind: task.hold.kind, heldMinutes },
      }, context);
    }

    case "useFallback": {
      const occurrence = getOpenOccurrence(state, action.occurrenceId);
      const task = getTask(occurrence, action.taskId);
      if (isTaskResolved(task)) throw new DomainError("task-resolved", task.id);
      if (!task.fallback) throw new DomainError("no-fallback", task.id);
      const note = optionalNote(action.note, HOLD_NOTE_MAX_LENGTH) ?? message("note.fallback-used", { fallback: task.fallback });
      return changeTask(state, occurrence, task.id, (current) => resolvedTask(current, "done", now, note, true), {
        kind: "fallback-used",
        detail: { previousStatus: task.status, responsible: assigneeRef(task.responsible) },
      }, context);
    }

    case "reassignTask": {
      const occurrence = getOpenOccurrence(state, action.occurrenceId);
      const task = getTask(occurrence, action.taskId);
      if (isTaskResolved(task)) throw new DomainError("task-resolved", task.id);
      if (task.criticality === "essential" && action.responsible.kind === "unassigned") {
        throw new DomainError("essential-unassigned", task.id);
      }
      assertAssigneeExists(state, action.responsible);
      const from = assigneeRef(task.responsible);
      const to = assigneeRef(action.responsible);
      if (from === to) throw new DomainError("same-assignee");
      // A reassignment is a deliberate change and overwrites `responsible` (§5.2), unlike coverage.
      return changeTask(state, occurrence, task.id, (current) => ({ ...current, responsible: structuredClone(action.responsible) }), {
        kind: "task-reassigned",
        detail: { from, to },
      }, context);
    }

    case "moveOccurrence": {
      const occurrence = getOpenOccurrence(state, action.occurrenceId);
      const anchorAt = toInstant(action.anchorAt);
      const delta = minutesBetween(occurrence.anchorAt, anchorAt);
      const playbook = findPlaybook(state, occurrence.playbookId, occurrence.playbookVersion);
      // Due dates are recalculated from the new anchor for unresolved tasks only (§6.5).
      const tasks = occurrence.tasks.map((task) => {
        if (isTaskResolved(task)) return task;
        const template = playbook?.tasks.find((item) => item.id === task.id);
        const dueAt = template ? resolveDueAt(anchorAt, template) : addMinutes(task.dueAt, delta);
        return { ...task, dueAt };
      });
      const next: Occurrence = {
        ...occurrence,
        anchorAt,
        originalAnchorAt: occurrence.originalAnchorAt ?? occurrence.anchorAt,
        tasks,
      };
      return replaceOccurrence(state, {
        ...next,
        history: [...occurrence.history, historyEvent(occurrence, "moved", now, context.actorId, { from: occurrence.anchorAt, to: anchorAt })],
      });
    }

    case "skipOccurrence": {
      const occurrence = getOpenOccurrence(state, action.occurrenceId);
      const reason = requireNote(action.reason, SKIP_REASON_MAX_LENGTH);
      return replaceOccurrence(state, {
        ...occurrence,
        status: "skipped",
        closedAt: now,
        closeNote: reason,
        history: [...occurrence.history, historyEvent(occurrence, "skipped", now, context.actorId, { previousStatus: occurrence.status })],
      });
    }

    case "closeOccurrence": {
      const occurrence = getOpenOccurrence(state, action.occurrenceId);
      const operation = getOperation(state, occurrence.operationId);
      if (action.outcome === "cancelled" && operation.schedule !== null) throw new DomainError("cancel-one-off-only");
      if (!closeOptions(occurrence, operation).includes(action.outcome)) {
        throw new DomainError("outcome-not-allowed", action.outcome);
      }
      const note = outcomeRequiresNote(action.outcome) ? requireNote(action.note) : trimmed(action.note);
      const reviewNote = trimmed(action.reviewNote);
      const assessment = assessOutcome(occurrence);
      return replaceOccurrence(state, {
        ...occurrence,
        status: action.outcome,
        closedAt: now,
        ...(note ? { closeNote: note } : {}),
        ...(reviewNote ? { reviewNote } : {}),
        ...(action.playbookFeedback ? { playbookFeedback: true } : {}),
        history: [...occurrence.history, historyEvent(occurrence, "closed", now, context.actorId, {
          outcome: action.outcome,
          lateEssential: assessment.lateEssential.length,
          skippedEssential: assessment.skippedEssential.length,
          ...(assessment.lateFollowUpOnly ? { lateFollowUpOnly: true } : {}),
        })],
      });
    }

    case "createOperation": {
      const input = action.operation;
      const id = input.id.trim();
      if (!id || state.operations.some((item) => item.id === id)) throw new DomainError("duplicate-id", id);
      const newOccurrenceId = buildOccurrenceId(id, ONE_OFF_PERIOD_KEY);
      if (state.occurrences.some((item) => item.id === newOccurrenceId)) throw new DomainError("duplicate-id", newOccurrenceId);
      const playbook = findPlaybook(state, input.playbookId);
      if (!playbook) throw new DomainError("playbook-not-found", input.playbookId);
      if (playbook.status !== "available" || playbook.tasks.length === 0) throw new DomainError("playbook-not-available", playbook.id);
      assertOwnership(state, input.ownerId, input.backupId);
      const operation: Operation = {
        id,
        title: requireNote(input.title),
        area: playbook.area,
        playbookId: playbook.id,
        playbookVersion: playbook.version,
        ownerId: input.ownerId,
        ...(input.backupId ? { backupId: input.backupId } : {}),
        schedule: null,
        status: "active",
        createdAt: now,
      };
      const occurrence = instantiateOccurrence({
        operation,
        playbook,
        periodKey: ONE_OFF_PERIOD_KEY,
        anchorAt: toInstant(action.anchorAt),
        location: action.location,
        now,
        actorId: context.actorId,
      });
      return {
        ...state,
        modified: true,
        operations: [operation, ...state.operations],
        occurrences: [occurrence, ...state.occurrences],
      };
    }

    case "updateOwnership": {
      const operation = getOperation(state, action.operationId);
      assertOwnership(state, action.ownerId, action.backupId);
      if (operation.ownerId === action.ownerId && operation.backupId === action.backupId) throw new DomainError("same-assignee");
      const { backupId: _previousBackup, ...rest } = operation;
      void _previousBackup;
      const updated: Operation = { ...rest, ownerId: action.ownerId, ...(action.backupId ? { backupId: action.backupId } : {}) };
      const playbook = findPlaybook(state, updated.playbookId, updated.playbookVersion);
      if (!playbook) throw new DomainError("playbook-not-found", updated.playbookId);
      // Snapshot rule (§4.3): only not-started occurrences are regenerated; started and closed ones keep
      // their owner, backup and task assignments.
      const occurrences = state.occurrences.map((occurrence) => {
        if (occurrence.operationId !== updated.id || !isNotStarted(occurrence)) return occurrence;
        const regenerated = instantiateOccurrence({
          operation: updated,
          playbook,
          periodKey: occurrence.periodKey,
          anchorAt: occurrence.anchorAt,
          location: occurrence.eventDetails?.location,
          now,
          actorId: context.actorId,
        });
        return {
          ...regenerated,
          history: [historyEvent({ ...regenerated, history: [] }, "generated", now, context.actorId, {
            playbookId: playbook.id,
            playbookVersion: playbook.version,
            reason: "ownership-changed",
          })],
        };
      });
      return {
        ...state,
        modified: true,
        operations: state.operations.map((item) => (item.id === updated.id ? updated : item)),
        occurrences,
      };
    }

    case "setOperationStatus": {
      const operation = getOperation(state, action.operationId);
      if (operation.status === action.status || operation.status === "retired") throw new DomainError("invalid-status", action.status);
      // Pausing or retiring never deletes or changes generated occurrences (§6.4); they can still be skipped.
      return {
        ...state,
        modified: true,
        operations: state.operations.map((item) => (item.id === operation.id ? { ...item, status: action.status } : item)),
      };
    }
  }
}
