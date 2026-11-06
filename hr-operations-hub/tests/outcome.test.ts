/**
 * Close-out outcome semantics (§6.5, D19, D29, D31) on neutral fixtures. The reviewed payroll and
 * reporting playbooks are M5; R1–R16 against them run in M8.
 */
import { describe, expect, it } from "vitest";
import { addMinutes, DomainError } from "../lib/domain/occurrence";
import { assessOutcome, closeOptions, outcomeRequiresNote } from "../lib/domain/outcome";
import { applyAction } from "../lib/domain/reducer";
import { createSeedStore, CURRENT_USER_ID, RESCUE_OCCURRENCE_ID } from "../lib/domain/seed";
import type { Criticality, Occurrence, StoreV3, Task, TaskStatus } from "../lib/domain/types";

const ANCHOR = "2026-11-04T09:00:00.000Z"; // Wed 04.11.2026 10:00 Vienna

function makeTask(id: string, criticality: Criticality, dueOffsetMinutes: number, status: TaskStatus = "not-started", resolvedOffset?: number): Task {
  return {
    id,
    title: id,
    description: "",
    ownerRole: "HR",
    dueAt: addMinutes(ANCHOR, dueOffsetMinutes),
    responsible: { kind: "person", personId: "p-sophie" },
    contributors: [],
    criticality,
    estimatedMinutes: 10,
    dependsOn: [],
    status,
    ...(resolvedOffset !== undefined ? { resolvedAt: addMinutes(ANCHOR, resolvedOffset) } : {}),
  };
}

/** Neutral fixture: a pre-anchor essential (−1 day), an essential at the anchor, a post-anchor essential (+1 day), important and optional tasks. */
function fixture(overrides: Partial<Record<string, Partial<Task>>> = {}): Pick<Occurrence, "anchorAt" | "tasks"> {
  const tasks = [
    makeTask("prepare", "essential", -24 * 60, "done", -24 * 60 - 30),
    makeTask("deliver", "essential", 0, "done", -10),
    makeTask("review", "essential", 24 * 60, "done", 23 * 60),
    makeTask("extra", "important", -60, "done", -90),
    makeTask("followup", "optional", 120, "done", 60),
  ].map((task) => ({ ...task, ...overrides[task.id] }));
  return { anchorAt: ANCHOR, tasks };
}

const at = (offset: number) => addMinutes(ANCHOR, offset);

describe("assessOutcome", () => {
  it("completed: every essential task done at or before its own due time", () => {
    expect(assessOutcome(fixture())).toMatchObject({ outcome: "completed", skippedEssential: [], openEssential: [], lateEssential: [] });
    // Exactly at the due time is on time.
    expect(assessOutcome(fixture({ deliver: { resolvedAt: at(0) } })).outcome).toBe("completed");
  });

  it("completed-late: every essential done, at least one after its own due time", () => {
    const result = assessOutcome(fixture({ prepare: { resolvedAt: at(-24 * 60 + 1) } }));
    expect(result).toMatchObject({ outcome: "completed-late", lateEssential: ["prepare"], lateFollowUpOnly: false });
  });

  it("evaluates each task's own dueAt and resolvedAt, never the anchor or the close time", () => {
    // A post-anchor essential done after the anchor but before its own due time is on time.
    expect(assessOutcome(fixture({ review: { resolvedAt: at(12 * 60) } })).outcome).toBe("completed");
    // The function has no notion of "when Close is clicked": the same data always gives the same outcome.
    const data = fixture();
    expect(assessOutcome(data)).toEqual(assessOutcome(structuredClone(data)));
  });

  it("D29: a late post-anchor follow-up gives completed-late with the late follow-up qualifier", () => {
    const result = assessOutcome(fixture({ review: { resolvedAt: at(24 * 60 + 60) } }));
    expect(result).toMatchObject({ outcome: "completed-late", lateEssential: ["review"], lateFollowUpOnly: true });
  });

  it("R14: a skipped essential task allows only missed, even with every other essential done on time", () => {
    const result = assessOutcome(fixture({ deliver: { status: "skipped", resolvedAt: at(-30) } }));
    expect(result).toMatchObject({ outcome: "missed", skippedEssential: ["deliver"], openEssential: [] });
  });

  it("a skipped essential is never completed-late either", () => {
    const result = assessOutcome(fixture({ deliver: { status: "skipped", resolvedAt: at(-30) }, prepare: { resolvedAt: at(0) } }));
    expect(result.outcome).toBe("missed");
  });

  it("R15/R16: skipped important or optional tasks do not change the outcome", () => {
    expect(assessOutcome(fixture({ extra: { status: "skipped", resolvedAt: at(-100) } })).outcome).toBe("completed");
    expect(assessOutcome(fixture({ followup: { status: "skipped", resolvedAt: at(30) } })).outcome).toBe("completed");
    // Open non-essential tasks do not affect it either.
    expect(assessOutcome(fixture({ extra: { status: "not-started", resolvedAt: undefined } })).outcome).toBe("completed");
  });

  it("missed while any essential task is open, on hold, or an open post-anchor essential", () => {
    for (const status of ["not-started", "in-progress", "waiting", "blocked"] as TaskStatus[]) {
      const result = assessOutcome(fixture({ review: { status, resolvedAt: undefined } }));
      expect(result).toMatchObject({ outcome: "missed", openEssential: ["review"] });
    }
  });

  it("a done task without a resolvedAt cannot prove it was done and counts as open", () => {
    expect(assessOutcome(fixture({ deliver: { resolvedAt: undefined } }))).toMatchObject({ outcome: "missed", openEssential: ["deliver"] });
  });
});

describe("closeOptions and the reducer's close", () => {
  const NOW = "2026-11-03T08:10:00.000Z";
  const ctx = { now: NOW, actorId: CURRENT_USER_ID };

  function storeWith(update: (occurrence: Occurrence) => Occurrence): StoreV3 {
    const store = createSeedStore("2026-11-03T08:00:00.000Z");
    return { ...store, occurrences: store.occurrences.map((item) => (item.id === RESCUE_OCCURRENCE_ID ? update(item) : item)) };
  }
  const allDone = (resolvedOffsetFromDue: number) => (occurrence: Occurrence): Occurrence => ({
    ...occurrence,
    tasks: occurrence.tasks.map((task) => ({ ...task, status: "done", resolvedAt: addMinutes(task.dueAt, resolvedOffsetFromDue) })),
  });

  it("offers only the computed outcome when every essential is done, plus cancelled for one-off operations", () => {
    const onTime = storeWith(allDone(-5));
    const occurrence = onTime.occurrences.find((item) => item.id === RESCUE_OCCURRENCE_ID)!;
    expect(closeOptions(occurrence, { schedule: null })).toEqual(["completed", "cancelled"]);
    expect(closeOptions(occurrence, { schedule: {} as never })).toEqual(["completed"]);
    const closed = applyAction(onTime, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "completed" }, ctx);
    expect(closed.occurrences.find((item) => item.id === RESCUE_OCCURRENCE_ID)!.status).toBe("completed");
  });

  it("closing later never makes an on-time occurrence late", () => {
    const onTime = storeWith(allDone(-5));
    const muchLater = { ...ctx, now: "2027-01-15T12:00:00.000Z" };
    const closed = applyAction(onTime, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "completed" }, muchLater);
    expect(closed.occurrences.find((item) => item.id === RESCUE_OCCURRENCE_ID)!.status).toBe("completed");
  });

  it("closes a late occurrence only as completed-late", () => {
    const late = storeWith(allDone(5));
    expect(() => applyAction(late, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "completed" }, ctx)).toThrow(DomainError);
    const closed = applyAction(late, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "completed-late" }, ctx);
    expect(closed.occurrences.find((item) => item.id === RESCUE_OCCURRENCE_ID)!.status).toBe("completed-late");
  });

  it("R14 through the reducer: after skipping an essential task only missed with a note is accepted", () => {
    let store = storeWith(allDone(-5));
    store = applyAction(store, { type: "reopenTask", occurrenceId: RESCUE_OCCURRENCE_ID, taskId: "it-setup" }, ctx);
    store = applyAction(store, { type: "skipTask", occurrenceId: RESCUE_OCCURRENCE_ID, taskId: "it-setup", reason: "Room has no screen" }, ctx);
    const occurrence = store.occurrences.find((item) => item.id === RESCUE_OCCURRENCE_ID)!;
    expect(closeOptions(occurrence, { schedule: {} as never })).toEqual(["missed"]);
    for (const outcome of ["completed", "completed-late"] as const) {
      expect(() => applyAction(store, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome }, ctx)).toThrow(DomainError);
    }
    expect(() => applyAction(store, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "missed" }, ctx)).toThrow(DomainError);
    const closed = applyAction(store, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "missed", note: "IT check skipped" }, ctx);
    const result = closed.occurrences.find((item) => item.id === RESCUE_OCCURRENCE_ID)!;
    expect(result).toMatchObject({ status: "missed", closeNote: "IT check skipped" });
    expect(result.history.at(-1)!.detail).toMatchObject({ outcome: "missed", skippedEssential: 1 });
  });

  it("R16 through the reducer: skipping the optional follow-up keeps the outcome completed", () => {
    let store = storeWith(allDone(-5));
    store = applyAction(store, { type: "reopenTask", occurrenceId: RESCUE_OCCURRENCE_ID, taskId: "attendance-followup" }, ctx);
    store = applyAction(store, { type: "skipTask", occurrenceId: RESCUE_OCCURRENCE_ID, taskId: "attendance-followup", reason: "Not needed" }, ctx);
    const closed = applyAction(store, { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "completed" }, ctx);
    expect(closed.occurrences.find((item) => item.id === RESCUE_OCCURRENCE_ID)!.status).toBe("completed");
  });

  it("requires a note for missed and cancelled only", () => {
    expect(outcomeRequiresNote("missed")).toBe(true);
    expect(outcomeRequiresNote("cancelled")).toBe(true);
    expect(outcomeRequiresNote("completed")).toBe(false);
    expect(outcomeRequiresNote("completed-late")).toBe(false);
  });

  it("offers nothing for an occurrence that is already closed", () => {
    const store = createSeedStore("2026-11-03T08:00:00.000Z");
    const closed = store.occurrences.find((item) => item.status === "completed")!;
    expect(closeOptions(closed, { schedule: null })).toEqual([]);
  });
});
