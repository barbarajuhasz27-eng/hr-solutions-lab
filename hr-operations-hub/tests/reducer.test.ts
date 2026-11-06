import { afterEach, describe, expect, it, vi } from "vitest";
import { DomainError } from "../lib/domain/occurrence";
import { applyAction, type ActionContext, type HubAction, type HubActionType } from "../lib/domain/reducer";
import {
  COMPLETED_OCCURRENCE_ID,
  createSeedStore,
  CURRENT_USER_ID,
  RESCUE_OCCURRENCE_ID,
  RESCUE_OPERATION_ID,
  UPCOMING_OCCURRENCE_ID,
} from "../lib/domain/seed";
import type { HistoryEvent, Occurrence, StoreV3, Task } from "../lib/domain/types";
import { findInvariantViolations } from "../lib/domain/validate";
import { monthlySchedule, recurringOperation, storeWith } from "./fixtures/schedule";

const SEEDED = "2026-11-03T08:00:00.000Z";
const NOW = "2026-11-03T08:10:00.000Z";
const LATER = "2026-11-03T08:25:00.000Z";
const ctx: ActionContext = { now: NOW, actorId: CURRENT_USER_ID };
const MINUTE = 60_000;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

/** Applies an action to a frozen copy, so any mutation of the previous state throws. */
function run(state: StoreV3, action: HubAction, context: ActionContext = ctx): StoreV3 {
  const frozen = deepFreeze(structuredClone(state));
  const before = JSON.stringify(frozen);
  const next = applyAction(frozen, action, context);
  expect(JSON.stringify(frozen)).toBe(before);
  expect(next).not.toBe(frozen);
  expect(findInvariantViolations(next)).toEqual([]);
  return next;
}

const seed = () => createSeedStore(SEEDED);
const CUTOFF_NOV = "op-cutoff:2026-11";
const CUTOFF_DEC = "op-cutoff:2026-12";
const occ = (state: StoreV3, id = RESCUE_OCCURRENCE_ID) => state.occurrences.find((item) => item.id === id)!;
const task = (state: StoreV3, taskId: string, id = RESCUE_OCCURRENCE_ID): Task => occ(state, id).tasks.find((item) => item.id === taskId)!;
const lastEvent = (state: StoreV3, id = RESCUE_OCCURRENCE_ID): HistoryEvent => occ(state, id).history.at(-1)!;

function expectEvent(state: StoreV3, previous: StoreV3, expected: Partial<HistoryEvent>, id = RESCUE_OCCURRENCE_ID) {
  const before = occ(previous, id).history;
  const after = occ(state, id).history;
  expect(after).toHaveLength(before.length + 1);
  expect(after.slice(0, before.length)).toEqual(before);
  expect(after.at(-1)).toMatchObject({ id: `${id}#${before.length + 1}`, at: NOW, actorId: CURRENT_USER_ID, ...expected });
}

function expectRejected(state: StoreV3, action: HubAction, code: DomainError["code"]) {
  try {
    applyAction(deepFreeze(structuredClone(state)), action, ctx);
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    expect((error as DomainError).code).toBe(code);
    return;
  }
  throw new Error(`expected ${action.type} to be rejected with ${code}`);
}

const target = { occurrenceId: RESCUE_OCCURRENCE_ID, taskId: "room-confirmed" };

describe("task actions", () => {
  it("completeTask: done, resolvedAt = now, note kept, hold cleared — with a task-completed event", () => {
    const held = run(seed(), { type: "setHold", ...target, hold: { kind: "waiting", waitingOn: "Facilities" } });
    const next = run(held, { type: "completeTask", ...target, note: "Room 2.14 confirmed" });
    expect(task(next, "room-confirmed")).toMatchObject({ status: "done", resolvedAt: NOW, completionNote: "Room 2.14 confirmed" });
    expect(task(next, "room-confirmed").hold).toBeUndefined();
    expect(next.modified).toBe(true);
    expectEvent(next, held, { kind: "task-completed", taskId: "room-confirmed", detail: { previousStatus: "waiting", responsible: "counterparty:cp-facilities" } });
  });

  it("completeTask rejects resolved tasks, unknown tasks and unknown occurrences", () => {
    const done = run(seed(), { type: "completeTask", ...target });
    expectRejected(done, { type: "completeTask", ...target }, "task-resolved");
    expectRejected(seed(), { type: "completeTask", occurrenceId: RESCUE_OCCURRENCE_ID, taskId: "nope" }, "task-not-found");
    expectRejected(seed(), { type: "completeTask", occurrenceId: "nope", taskId: "x" }, "occurrence-not-found");
  });

  it("skipTask: skipped, resolvedAt = now, reason as note — with a skipped event carrying the task", () => {
    const state = seed();
    const next = run(state, { type: "skipTask", occurrenceId: RESCUE_OCCURRENCE_ID, taskId: "attendance-followup", reason: "Attendance taken on paper" });
    expect(task(next, "attendance-followup")).toMatchObject({ status: "skipped", resolvedAt: NOW, completionNote: "Attendance taken on paper" });
    expectEvent(next, state, { kind: "skipped", taskId: "attendance-followup", detail: { previousStatus: "not-started", criticality: "optional" } });
    expectRejected(state, { type: "skipTask", ...target, reason: "  " }, "note-required");
    expectRejected(state, { type: "skipTask", ...target, reason: "x".repeat(161) }, "note-too-long");
  });

  it("reopenTask: back to not-started and clears resolvedAt, note and fallback — with a task-reopened event", () => {
    const fallback = run(seed(), { type: "useFallback", ...target });
    const reopened = run(fallback, { type: "reopenTask", ...target }, { ...ctx, now: NOW });
    const reopenedTask = task(reopened, "room-confirmed");
    expect(reopenedTask.status).toBe("not-started");
    expect(reopenedTask.resolvedAt).toBeUndefined();
    expect(reopenedTask.completionNote).toBeUndefined();
    expect(reopenedTask.fallbackUsed).toBeUndefined();
    expectEvent(reopened, fallback, { kind: "task-reopened", taskId: "room-confirmed", detail: { previousStatus: "done", fallbackWasUsed: true } });

    const skipped = run(seed(), { type: "skipTask", ...target, reason: "Not needed" });
    expect(task(run(skipped, { type: "reopenTask", ...target }), "room-confirmed").resolvedAt).toBeUndefined();
    expectRejected(seed(), { type: "reopenTask", ...target }, "task-not-resolved");
  });

  it("setHold: waiting with waiting-on and note, since = now — with a hold-set event", () => {
    const state = seed();
    const next = run(state, { type: "setHold", ...target, hold: { kind: "waiting", waitingOn: " Facilities ", note: " Asked at 09:10 " } });
    expect(task(next, "room-confirmed")).toMatchObject({ status: "waiting", hold: { kind: "waiting", waitingOn: "Facilities", note: "Asked at 09:10", since: NOW } });
    expectEvent(next, state, { kind: "hold-set", taskId: "room-confirmed", detail: { holdKind: "waiting", waitingOn: "Facilities", previousStatus: "not-started" } });
  });

  it("setHold: blocked needs a note; editing the same kind keeps since, a new kind restarts it", () => {
    const state = seed();
    expectRejected(state, { type: "setHold", ...target, hold: { kind: "blocked" } }, "invalid-hold");
    expectRejected(state, { type: "setHold", ...target, hold: { kind: "waiting", waitingOn: "" } }, "invalid-hold");
    expectRejected(state, { type: "setHold", ...target, hold: { kind: "waiting", waitingOn: "x".repeat(61) } }, "invalid-hold");
    const waiting = run(state, { type: "setHold", ...target, hold: { kind: "waiting", waitingOn: "Facilities" } });
    const edited = run(waiting, { type: "setHold", ...target, hold: { kind: "waiting", waitingOn: "Mara Klein" } }, { ...ctx, now: LATER });
    expect(task(edited, "room-confirmed").hold).toMatchObject({ waitingOn: "Mara Klein", since: NOW });
    const blocked = run(edited, { type: "setHold", ...target, hold: { kind: "blocked", note: "Double-booked" } }, { ...ctx, now: LATER });
    expect(task(blocked, "room-confirmed")).toMatchObject({ status: "blocked", hold: { kind: "blocked", note: "Double-booked", since: LATER } });
    expect(task(blocked, "room-confirmed").hold?.waitingOn).toBeUndefined();
    expectRejected(run(state, { type: "completeTask", ...target }), { type: "setHold", ...target, hold: { kind: "waiting", waitingOn: "x" } }, "task-resolved");
  });

  it("releaseHold: back to not-started without a hold — with a hold-released event recording the duration", () => {
    const held = run(seed(), { type: "setHold", ...target, hold: { kind: "blocked", note: "Double-booked" } });
    const later: ActionContext = { ...ctx, now: LATER };
    const next = applyAction(deepFreeze(structuredClone(held)), { type: "releaseHold", ...target }, later);
    expect(task(next, "room-confirmed").status).toBe("not-started");
    expect(task(next, "room-confirmed").hold).toBeUndefined();
    expect(lastEvent(next)).toMatchObject({ kind: "hold-released", at: LATER, taskId: "room-confirmed", detail: { holdKind: "blocked", heldMinutes: 15 } });
    expectRejected(seed(), { type: "releaseHold", ...target }, "task-not-on-hold");
  });

  it("useFallback: done with fallbackUsed and the catalogue note — with a fallback-used event", () => {
    const state = seed();
    const next = run(state, { type: "useFallback", ...target });
    expect(task(next, "room-confirmed")).toMatchObject({
      status: "done",
      fallbackUsed: true,
      resolvedAt: NOW,
      completionNote: "Fallback used: Switch to an available alternative room or a virtual format.",
    });
    expectEvent(next, state, { kind: "fallback-used", taskId: "room-confirmed" });

    const withoutFallback = structuredClone(state);
    delete occ(withoutFallback).tasks.find((item) => item.id === "room-confirmed")!.fallback;
    expectRejected(withoutFallback, { type: "useFallback", ...target }, "no-fallback");
  });

  it("reassignTask: overwrites responsible — with a task-reassigned event (from → to)", () => {
    const state = seed();
    const next = run(state, { type: "reassignTask", ...target, responsible: { kind: "person", personId: "p-daniel" } });
    expect(task(next, "room-confirmed").responsible).toEqual({ kind: "person", personId: "p-daniel" });
    expectEvent(next, state, { kind: "task-reassigned", taskId: "room-confirmed", detail: { from: "counterparty:cp-facilities", to: "person:p-daniel" } });
  });

  it("reassignTask: an essential task can never be unassigned; a non-essential one can", () => {
    const state = seed();
    expectRejected(state, { type: "reassignTask", ...target, responsible: { kind: "unassigned" } }, "essential-unassigned");
    const optional = run(state, { type: "reassignTask", occurrenceId: RESCUE_OCCURRENCE_ID, taskId: "attendance-followup", responsible: { kind: "unassigned" } });
    expect(task(optional, "attendance-followup").responsible).toEqual({ kind: "unassigned" });
    expectRejected(state, { type: "reassignTask", ...target, responsible: { kind: "person", personId: "p-nobody" } }, "unknown-assignee");
    expectRejected(state, { type: "reassignTask", ...target, responsible: { kind: "counterparty", counterpartyId: "cp-facilities" } }, "same-assignee");
  });
});

describe("occurrence actions", () => {
  it("moveOccurrence: new anchor, original kept, unresolved due dates recalculated — with a moved event", () => {
    const state = run(seed(), { type: "completeTask", ...target });
    const original = occ(state);
    const newAnchor = new Date(new Date(original.anchorAt).getTime() + 120 * MINUTE).toISOString();
    const moved = run(state, { type: "moveOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, anchorAt: newAnchor });
    const result = occ(moved);
    expect(result.anchorAt).toBe(newAnchor);
    expect(result.originalAnchorAt).toBe(original.anchorAt);
    for (const item of result.tasks) {
      const before = original.tasks.find((candidate) => candidate.id === item.id)!;
      if (item.id === "room-confirmed") expect(item.dueAt).toBe(before.dueAt); // resolved: unchanged
      else expect(new Date(item.dueAt).getTime() - new Date(before.dueAt).getTime()).toBe(120 * MINUTE);
    }
    expectEvent(moved, state, { kind: "moved", detail: { from: original.anchorAt, to: newAnchor } });

    const movedAgain = run(moved, { type: "moveOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, anchorAt: SEEDED });
    expect(occ(movedAgain).originalAnchorAt).toBe(original.anchorAt);
    expectRejected(state, { type: "moveOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, anchorAt: "soon" }, "invalid-instant");
  });

  it("skipOccurrence: skipped with a reason and closedAt, then read-only — with a skipped event", () => {
    const state = seed();
    const next = run(state, { type: "skipOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, reason: "Trainer unavailable, session dropped" });
    expect(occ(next)).toMatchObject({ status: "skipped", closedAt: NOW, closeNote: "Trainer unavailable, session dropped" });
    expectEvent(next, state, { kind: "skipped", detail: { previousStatus: "active" } });
    expect(lastEvent(next).taskId).toBeUndefined();
    expectRejected(state, { type: "skipOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, reason: "" }, "note-required");
    expectRejected(state, { type: "skipOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, reason: "x".repeat(161) }, "note-too-long");
    expectRejected(next, { type: "completeTask", ...target }, "occurrence-closed");
  });

  it("closeOccurrence: the computed outcome — with a closed event; closed occurrences are read-only", () => {
    let state = seed();
    for (const item of occ(state).tasks) state = run(state, { type: "completeTask", occurrenceId: RESCUE_OCCURRENCE_ID, taskId: item.id });
    // The rescue tasks were due days earlier, so completing them now is late.
    const closed = run(state, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "completed-late", reviewNote: "Start earlier", playbookFeedback: true });
    expect(occ(closed)).toMatchObject({ status: "completed-late", closedAt: NOW, reviewNote: "Start earlier", playbookFeedback: true });
    expectEvent(closed, state, { kind: "closed", detail: { outcome: "completed-late", skippedEssential: 0 } });
    expectRejected(state, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "completed" }, "outcome-not-allowed");
    for (const action of [
      { type: "reopenTask", ...target },
      { type: "moveOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, anchorAt: NOW },
      { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "missed", note: "x" },
    ] as HubAction[]) {
      expectRejected(closed, action, "occurrence-closed");
    }
    expectRejected(seed(), { type: "completeTask", occurrenceId: COMPLETED_OCCURRENCE_ID, taskId: "it-setup" }, "occurrence-closed");
  });

  it("closeOccurrence: missed and cancelled require a note", () => {
    const state = seed();
    expectRejected(state, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "missed" }, "note-required");
    const missed = run(state, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "missed", note: "Session postponed" });
    expect(occ(missed)).toMatchObject({ status: "missed", closeNote: "Session postponed" });
    expectRejected(state, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "cancelled" }, "note-required");
    const cancelled = run(state, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "cancelled", note: "Training withdrawn" });
    expect(occ(cancelled).status).toBe("cancelled");
    expectEvent(cancelled, state, { kind: "closed", detail: { outcome: "cancelled" } });
  });
});

describe("operation actions", () => {
  const create: HubAction = {
    type: "createOperation",
    operation: { id: "op-new", title: "Onboarding workshop", playbookId: "training-session", ownerId: "p-lena", backupId: "p-daniel" },
    anchorAt: "2026-11-20T09:00:00.000Z",
    location: "Room 1.02",
  };

  it("createOperation: a one-off operation plus its occurrence snapshot — with a generated event", () => {
    const state = seed();
    const next = run(state, create);
    expect(next.operations[0]).toEqual({
      id: "op-new", title: "Onboarding workshop", area: "LD", playbookId: "training-session", playbookVersion: 2,
      ownerId: "p-lena", backupId: "p-daniel", schedule: null, status: "active", createdAt: NOW,
    });
    const created = next.occurrences[0];
    expect(created).toMatchObject({
      id: "op-new:once", operationId: "op-new", periodKey: "once", anchorKind: "event-start", anchorAt: "2026-11-20T09:00:00.000Z",
      status: "scheduled", ownerId: "p-lena", backupId: "p-daniel", playbookVersion: 2, eventDetails: { location: "Room 1.02" },
    });
    expect(created.tasks.find((item) => item.id === "trainer-confirmed")).toMatchObject({
      dueAt: "2026-11-13T09:00:00.000Z", responsible: { kind: "person", personId: "p-lena" }, status: "not-started",
    });
    expect(created.history).toEqual([
      { id: "op-new:once#1", at: NOW, actorId: CURRENT_USER_ID, kind: "generated", detail: { playbookId: "training-session", playbookVersion: 2 } },
    ]);
  });

  it("createOperation inside the lead time activates at once: generated, then activated", () => {
    const next = run(seed(), { ...create, anchorAt: "2026-11-05T09:00:00.000Z" } as HubAction);
    expect(next.occurrences[0].status).toBe("active");
    expect(next.occurrences[0].history.map((event) => event.kind)).toEqual(["generated", "activated"]);
  });

  it("createOperation validates IDs, ownership and the playbook", () => {
    const state = seed();
    expectRejected(run(state, create), create, "duplicate-id");
    expectRejected(state, { ...create, operation: { ...create.operation, ownerId: "cp-it" } } as HubAction, "owner-not-person");
    expectRejected(state, { ...create, operation: { ...create.operation, backupId: "p-lena" } } as HubAction, "backup-equals-owner");
    expectRejected(state, { ...create, operation: { ...create.operation, playbookId: "monthly-payroll-input" } } as HubAction, "playbook-not-found");
    const inDesign = structuredClone(state);
    inDesign.playbooks[0].status = "in-design";
    expectRejected(inDesign, create, "playbook-not-available");
  });

  it("createOperation rejects a missing backup when an essential task is assigned to the backup (§5.1)", () => {
    const state = structuredClone(seed());
    state.playbooks[0].tasks[0].responsible = { kind: "backup" };
    const withoutBackup = { ...create, operation: { ...create.operation, backupId: undefined } } as HubAction;
    expectRejected(state, withoutBackup, "backup-required");
    const next = run(state, create);
    expect(next.occurrences[0].tasks[0].responsible).toEqual({ kind: "person", personId: "p-daniel" });
  });

  it("updateOwnership: regenerates not-started occurrences — with a new generated event", () => {
    const created = run(seed(), create);
    const next = run(created, { type: "updateOwnership", operationId: "op-new", ownerId: "p-daniel", backupId: "p-lena" });
    expect(next.operations[0]).toMatchObject({ ownerId: "p-daniel", backupId: "p-lena" });
    const regenerated = next.occurrences[0];
    expect(regenerated).toMatchObject({ ownerId: "p-daniel", backupId: "p-lena" });
    expect(regenerated.tasks.find((item) => item.id === "trainer-confirmed")!.responsible).toEqual({ kind: "person", personId: "p-daniel" });
    expect(regenerated.history).toEqual([
      { id: "op-new:once#1", at: NOW, actorId: CURRENT_USER_ID, kind: "generated", detail: { playbookId: "training-session", playbookVersion: 2, reason: "ownership-changed" } },
    ]);
  });

  it("updateOwnership: never changes started or closed occurrences (snapshot rule §4.3)", () => {
    const started = run(run(seed(), create), { type: "completeTask", occurrenceId: "op-new:once", taskId: "trainer-confirmed" });
    const next = run(started, { type: "updateOwnership", operationId: "op-new", ownerId: "p-daniel" });
    expect(next.operations[0]).toMatchObject({ ownerId: "p-daniel" });
    expect(next.operations[0].backupId).toBeUndefined();
    expect(next.occurrences[0]).toEqual(started.occurrences[0]);
    const seeded = seed();
    const rescueOwnerChange = run(seeded, { type: "updateOwnership", operationId: RESCUE_OPERATION_ID, ownerId: "p-lena" });
    expect(occ(rescueOwnerChange)).toEqual(occ(seeded)); // active, with an `activated` event: started
    expectRejected(seeded, { type: "updateOwnership", operationId: RESCUE_OPERATION_ID, ownerId: "p-sophie" }, "same-assignee");
    expectRejected(seeded, { type: "updateOwnership", operationId: RESCUE_OPERATION_ID, ownerId: "p-sophie", backupId: "p-sophie" }, "backup-equals-owner");
  });

  it("setOperationStatus: pauses or retires an operation without touching its occurrences (no occurrence event)", () => {
    const state = seed();
    const paused = run(state, { type: "setOperationStatus", operationId: RESCUE_OPERATION_ID, status: "paused" });
    expect(paused.operations.find((item) => item.id === RESCUE_OPERATION_ID)!.status).toBe("paused");
    expect(paused.occurrences).toEqual(state.occurrences);
    expect(paused.modified).toBe(true);
    const retired = run(paused, { type: "setOperationStatus", operationId: RESCUE_OPERATION_ID, status: "retired" });
    expectRejected(retired, { type: "setOperationStatus", operationId: RESCUE_OPERATION_ID, status: "active" }, "invalid-status");
    expectRejected(state, { type: "setOperationStatus", operationId: RESCUE_OPERATION_ID, status: "active" }, "invalid-status");
  });
});

describe("reducer contract", () => {
  /** One representative action per type. The Record type makes the compiler demand an entry for every action. */
  const representative: Record<HubActionType, { action: HubAction; event: HistoryEvent["kind"] | null; occurrence?: string }> = {
    completeTask: { action: { type: "completeTask", ...target }, event: "task-completed" },
    skipTask: { action: { type: "skipTask", ...target, reason: "Virtual session" }, event: "skipped" },
    reopenTask: { action: { type: "reopenTask", occurrenceId: UPCOMING_OCCURRENCE_ID, taskId: "trainer-confirmed" }, event: "task-reopened", occurrence: UPCOMING_OCCURRENCE_ID },
    setHold: { action: { type: "setHold", ...target, hold: { kind: "waiting", waitingOn: "Facilities" } }, event: "hold-set" },
    releaseHold: { action: { type: "releaseHold", ...target }, event: "hold-released" },
    useFallback: { action: { type: "useFallback", ...target }, event: "fallback-used" },
    reassignTask: { action: { type: "reassignTask", ...target, responsible: { kind: "person", personId: "p-lena" } }, event: "task-reassigned" },
    moveOccurrence: { action: { type: "moveOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, anchorAt: LATER }, event: "moved" },
    skipOccurrence: { action: { type: "skipOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, reason: "Dropped" }, event: "skipped" },
    closeOccurrence: { action: { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "missed", note: "Postponed" }, event: "closed" },
    // Anchor outside the lead time, so creation adds only `generated` (inside it, `activated` follows; see below).
    createOperation: { action: { type: "createOperation", operation: { id: "op-x", title: "X", playbookId: "training-session", ownerId: "p-sophie" }, anchorAt: "2026-11-20T09:00:00.000Z" }, event: "generated", occurrence: "op-x:once" },
    updateOwnership: { action: { type: "updateOwnership", operationId: RESCUE_OPERATION_ID, ownerId: "p-lena" }, event: null },
    setOperationStatus: { action: { type: "setOperationStatus", operationId: RESCUE_OPERATION_ID, status: "paused" }, event: null },
    // M2. A started occurrence only gets a drift suggestion, without an event; the decision is logged.
    advanceSchedule: { action: { type: "advanceSchedule" }, event: "generated", occurrence: CUTOFF_DEC },
    updateSchedule: { action: { type: "updateSchedule", operationId: "op-cutoff", change: { rule: { kind: "workingDaysBeforeMonthEnd", n: 3 } }, effectiveFrom: "2026-11-01" }, event: null, occurrence: CUTOFF_NOV },
    updateCalendar: { action: { type: "updateCalendar", change: { companyClosures: [{ date: "2026-11-30", name: "Closure" }] } }, event: null, occurrence: CUTOFF_NOV },
    decideDrift: { action: { type: "decideDrift", occurrenceId: CUTOFF_NOV, kind: "calendar", decision: "keep" }, event: "drift-kept", occurrence: CUTOFF_NOV },
  };

  function prepared(type: HubActionType): StoreV3 {
    const state = seed();
    if (type === "releaseHold") return applyAction(state, representative.setHold.action, { ...ctx, now: SEEDED });
    const recurring = storeWith(SEEDED, [recurringOperation("op-cutoff", monthlySchedule())]);
    if (type === "advanceSchedule") return recurring;
    // November generated and started (a hold), December and January not started.
    let started = applyAction(recurring, { type: "advanceSchedule" }, { ...ctx, now: SEEDED });
    started = applyAction(started, { type: "setHold", occurrenceId: CUTOFF_NOV, taskId: "collect", hold: { kind: "waiting", waitingOn: "Finance" } }, { ...ctx, now: SEEDED });
    if (type === "updateSchedule" || type === "updateCalendar") return started;
    if (type === "decideDrift") return applyAction(started, representative.updateCalendar.action, { ...ctx, now: SEEDED });
    return state;
  }

  it.each(Object.keys(representative) as HubActionType[])("%s appends its history event with actor, time and structured detail", (type) => {
    const { action, event, occurrence = RESCUE_OCCURRENCE_ID } = representative[type];
    const state = prepared(type);
    const next = run(state, action);
    // Generation and activation are automatic and do not count as the visitor's changes.
    expect(next.modified).toBe(type !== "advanceSchedule");
    const before = state.occurrences.find((item) => item.id === occurrence)?.history ?? [];
    const after = next.occurrences.find((item) => item.id === occurrence)!.history;
    if (event === null) {
      // Operation-level change: occurrences change only where the snapshot rule allows, and only then get an event.
      expect(after).toEqual(before);
      return;
    }
    expect(after).toHaveLength(before.length + 1);
    const appended = after.at(-1)!;
    expect(appended).toMatchObject({ kind: event, at: NOW, actorId: CURRENT_USER_ID });
    expect(typeof appended.detail).toBe("object");
    for (const value of Object.values(appended.detail)) expect(["string", "number", "boolean"]).toContain(typeof value);
  });

  it("is deterministic: the same state, action and context give the same result", () => {
    for (const [type, { action }] of Object.entries(representative)) {
      const a = applyAction(prepared(type as HubActionType), action, ctx);
      const b = applyAction(prepared(type as HubActionType), action, ctx);
      expect(a).toEqual(b);
    }
  });

  it("never reads the clock: every new timestamp comes from the context", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2099-01-01T00:00:00.000Z"));
    for (const [type, { action }] of Object.entries(representative)) {
      const next = applyAction(prepared(type as HubActionType), action, ctx);
      expect(JSON.stringify(next)).not.toContain("2099");
    }
  });

  it("rejects an invalid context time", () => {
    expect(() => applyAction(seed(), representative.completeTask.action, { now: "not a time", actorId: CURRENT_USER_ID })).toThrow(DomainError);
  });

  it("records the actor from the context, not a fixed user", () => {
    const next = applyAction(seed(), representative.completeTask.action, { now: NOW, actorId: "p-daniel" });
    expect(lastEvent(next).actorId).toBe("p-daniel");
  });
});

describe("resolvedAt (§6.5, D31)", () => {
  it("is set on done and on skipped, and cleared on reopen", () => {
    const steps: [HubAction, string | undefined][] = [
      [{ type: "completeTask", ...target }, NOW],
      [{ type: "reopenTask", ...target }, undefined],
      [{ type: "skipTask", ...target, reason: "Virtual" }, NOW],
      [{ type: "reopenTask", ...target }, undefined],
      [{ type: "useFallback", ...target }, NOW],
      [{ type: "reopenTask", ...target }, undefined],
      [{ type: "setHold", ...target, hold: { kind: "waiting", waitingOn: "Facilities" } }, undefined],
      [{ type: "completeTask", ...target }, NOW],
    ];
    let state = seed();
    for (const [action, expected] of steps) {
      state = run(state, action);
      expect(task(state, "room-confirmed").resolvedAt).toBe(expected);
    }
  });

  it("records the actual completion time, not the time of a later close", () => {
    let state = seed();
    const occurrence: Occurrence = occ(state);
    const onTime = new Date(new Date(occurrence.tasks[0].dueAt).getTime() - MINUTE).toISOString();
    state = applyAction(state, { type: "completeTask", occurrenceId: RESCUE_OCCURRENCE_ID, taskId: occurrence.tasks[0].id }, { ...ctx, now: onTime });
    expect(task(state, occurrence.tasks[0].id).resolvedAt).toBe(onTime);
  });
});

afterEach(() => {
  vi.useRealTimers();
});
