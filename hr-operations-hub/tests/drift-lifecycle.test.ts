/**
 * Drift lifecycle (§6.6, §6.7): one pending suggestion per occurrence, always the latest candidate from the
 * effective schedule and the current calendar together; every creation, replacement and clearing is logged;
 * move, close and skip require an explicit Apply or Keep first. Neutral fixtures.
 */
import { describe, expect, it } from "vitest";
import { localDateOf, localTimeOf } from "../lib/calendar/dates";
import { DomainError } from "../lib/domain/errors";
import { applyAction, type HubAction } from "../lib/domain/reducer";
import { CURRENT_USER_ID } from "../lib/domain/seed";
import type { HistoryEvent, Occurrence, StoreV3 } from "../lib/domain/types";
import { findInvariantViolations, parseStoreV3 } from "../lib/domain/validate";
import { formatDateTime } from "../lib/format";
import { describeHistoryEvent, message } from "../lib/messages/en";
import { advanceSchedule } from "../lib/schedule/generation";
import { monthlySchedule, recurringOperation, storeWith } from "./fixtures/schedule";

const GENERATED_AT = "2026-11-06T09:00:00.000Z";
// Tue 10.11.2026: November (anchor Mon 23.11. 12:00, five working days before month end) is active, i.e. started.
const NOW = "2026-11-10T09:00:00.000Z";
const ctx = { now: NOW, actorId: CURRENT_USER_ID };
const NOV = "op-cutoff:2026-11";
const DEC = "op-cutoff:2026-12";

// Vienna 12:00 in November is 11:00 UTC.
const ANCHOR = "2026-11-23T11:00:00.000Z";
const NOV_20 = "2026-11-20T11:00:00.000Z";
const NOV_24 = "2026-11-24T11:00:00.000Z";
const NOV_25 = "2026-11-25T11:00:00.000Z";

function base(): StoreV3 {
  const store = advanceSchedule(storeWith(GENERATED_AT, [recurringOperation("op-cutoff", monthlySchedule())]), GENERATED_AT, CURRENT_USER_ID).store;
  return advanceSchedule(store, NOW, CURRENT_USER_ID).store;
}

/** Applies actions in order; every intermediate store must parse and satisfy every invariant. */
function run(store: StoreV3, ...actions: HubAction[]): StoreV3 {
  return actions.reduce((state, action) => {
    const next = applyAction(state, action, ctx);
    expect(findInvariantViolations(next)).toEqual([]);
    expect(parseStoreV3(JSON.parse(JSON.stringify(next)))).not.toBeNull();
    return next;
  }, store);
}

const get = (store: StoreV3, id = NOV) => store.occurrences.find((occurrence) => occurrence.id === id)!;
const kinds = (occurrence: Occurrence) => occurrence.history.map((event) => event.kind);
/** History events added between two versions of the same occurrence. */
const added = (before: StoreV3, after: StoreV3, id = NOV): HistoryEvent[] => get(after, id).history.slice(get(before, id).history.length);
const drifts = (occurrence: Occurrence) => ({ scheduleDrift: occurrence.scheduleDrift, calendarDrift: occurrence.calendarDrift });
const local = (iso: string) => `${localDateOf(iso)} ${localTimeOf(iso)}`;

const wdbme = (n: number): HubAction => ({ type: "updateSchedule", operationId: "op-cutoff", change: { rule: { kind: "workingDaysBeforeMonthEnd", n } }, effectiveFrom: "2026-11-01" });
const closures = (...dates: string[]): HubAction => ({ type: "updateCalendar", change: { companyClosures: dates.map((date) => ({ date, name: "Test closure" })) } });
const decide = (kind: "schedule" | "calendar", decision: "apply" | "keep"): HubAction => ({ type: "decideDrift", occurrenceId: NOV, kind, decision });
const move = (anchorAt: string): HubAction => ({ type: "moveOccurrence", occurrenceId: NOV, anchorAt });
const close: HubAction = { type: "closeOccurrence", occurrenceId: NOV, outcome: "missed", note: "Provider closed" };
const skip: HubAction = { type: "skipOccurrence", occurrenceId: NOV, reason: "Provider closed" };

describe("creating a suggestion", () => {
  it("1. a schedule change creates scheduleDrift with exactly one drift-suggested event", () => {
    const before = base();
    const after = run(before, wdbme(3)); // L 30.11., back 27., 26., 25.
    expect(drifts(get(after))).toEqual({ scheduleDrift: NOV_25, calendarDrift: undefined });
    expect(added(before, after)).toEqual([
      { id: `${NOV}#3`, at: NOW, actorId: CURRENT_USER_ID, kind: "drift-suggested", detail: { source: "schedule", anchorAt: ANCHOR, suggested: NOV_25 } },
    ]);
    expect(get(after).anchorAt).toBe(ANCHOR);
  });

  it("2. a calendar change creates calendarDrift with exactly one drift-suggested event", () => {
    const before = base();
    const after = run(before, closures("2026-11-30")); // L 27.11., back 26., 25., 24., 23., 20.
    expect(drifts(get(after))).toEqual({ scheduleDrift: undefined, calendarDrift: NOV_20 });
    expect(added(before, after)).toMatchObject([{ kind: "drift-suggested", detail: { source: "calendar", anchorAt: ANCHOR, suggested: NOV_20 } }]);
  });

  it("3. repeating the same change adds no events", () => {
    const once = run(base(), wdbme(3), closures("2026-12-15"));
    const twice = run(once, wdbme(3), closures("2026-12-15"));
    expect(get(twice).history).toEqual(get(once).history);
    expect(drifts(get(twice))).toEqual(drifts(get(once)));
  });

  it("logs nothing for occurrences whose candidate did not change", () => {
    const before = base();
    // A closure in December changes nothing for November.
    const after = run(before, closures("2026-12-15"));
    expect(get(after)).toBe(get(before));
  });
});

describe("one pending suggestion, always the latest candidate", () => {
  it("4. a changed suggested date logs the old suggestion cleared and the new one created", () => {
    const first = run(base(), wdbme(3));
    const second = run(first, wdbme(4)); // 24.11.
    expect(drifts(get(second))).toEqual({ scheduleDrift: NOV_24, calendarDrift: undefined });
    expect(added(first, second)).toMatchObject([
      { kind: "drift-suggestion-cleared", detail: { source: "schedule", suggested: NOV_25, reason: "superseded" } },
      { kind: "drift-suggested", detail: { source: "schedule", anchorAt: ANCHOR, suggested: NOV_24 } },
    ]);
  });

  it("5. a calendar change supersedes an earlier schedule suggestion", () => {
    const scheduled = run(base(), wdbme(3));
    // New rule and new calendar together: L 27.11., back 26., 25., 24.
    const after = run(scheduled, closures("2026-11-30"));
    expect(drifts(get(after))).toEqual({ scheduleDrift: undefined, calendarDrift: NOV_24 });
    expect(added(scheduled, after)).toMatchObject([
      { kind: "drift-suggestion-cleared", detail: { source: "schedule", suggested: NOV_25, reason: "superseded" } },
      { kind: "drift-suggested", detail: { source: "calendar", suggested: NOV_24 } },
    ]);
    // The stale schedule suggestion cannot be decided on any more.
    expect(() => run(after, decide("schedule", "apply"))).toThrow(/no-drift/);
  });

  it("6. a schedule change supersedes an earlier calendar suggestion", () => {
    const calendared = run(base(), closures("2026-11-30"));
    const after = run(calendared, wdbme(3)); // with the closure: 24.11.
    expect(drifts(get(after))).toEqual({ scheduleDrift: NOV_24, calendarDrift: undefined });
    expect(added(calendared, after)).toMatchObject([
      { kind: "drift-suggestion-cleared", detail: { source: "calendar", suggested: NOV_20, reason: "superseded" } },
      { kind: "drift-suggested", detail: { source: "schedule", suggested: NOV_24 } },
    ]);
  });

  it("an unrelated change of the other kind leaves the pending suggestion and its source as they are", () => {
    const scheduled = run(base(), wdbme(3));
    const after = run(scheduled, closures("2026-12-15"));
    expect(drifts(get(after))).toEqual({ scheduleDrift: NOV_25, calendarDrift: undefined });
    expect(added(scheduled, after)).toEqual([]);
  });

  it("7. a change that makes the rule match the actual anchor clears the suggestion and logs it", () => {
    const scheduled = run(base(), wdbme(3));
    const after = run(scheduled, wdbme(5));
    expect(drifts(get(after))).toEqual({ scheduleDrift: undefined, calendarDrift: undefined });
    expect(added(scheduled, after)).toEqual([
      { id: `${NOV}#4`, at: NOW, actorId: CURRENT_USER_ID, kind: "drift-suggestion-cleared", detail: { source: "schedule", suggested: NOV_25, anchorAt: ANCHOR, reason: "no-longer-different" } },
    ]);
    // Same for a calendar suggestion when the closure is removed again.
    const calendared = run(base(), closures("2026-11-30"));
    const reverted = run(calendared, closures());
    expect(added(calendared, reverted)).toMatchObject([{ kind: "drift-suggestion-cleared", detail: { source: "calendar", suggested: NOV_20, reason: "no-longer-different" } }]);
  });

  it("a rule that can no longer place the period clears the suggestion", () => {
    const scheduled = run(base(), wdbme(3));
    const after = run(scheduled, { type: "updateSchedule", operationId: "op-cutoff", change: { rule: { kind: "nthWorkingDay", n: 23 } }, effectiveFrom: "2026-11-01" });
    expect(drifts(get(after))).toEqual({ scheduleDrift: undefined, calendarDrift: undefined });
    expect(added(scheduled, after)).toMatchObject([{ kind: "drift-suggestion-cleared", detail: { reason: "no-valid-candidate" } }]);
  });

  it("successive schedule and calendar changes before a decision: the user sees and applies only the latest candidate", () => {
    const store = run(base(), wdbme(3), closures("2026-11-30"), wdbme(4), closures("2026-11-27", "2026-11-30"));
    // Rule n=4 with closures 27. and 30.: L 26.11., back 25., 24., 23., 20.
    expect(drifts(get(store))).toEqual({ scheduleDrift: undefined, calendarDrift: NOV_20 });
    // n=3 → 25.11.; + closure 30. → 24.11.; n=4 with closure 30. → 23.11. = anchor (cleared); + closure 27. → 20.11.
    const trail = get(store).history.filter((event) => event.kind.startsWith("drift-")).map((event) => [event.kind, event.detail.source, event.detail.suggested, event.detail.reason]);
    expect(trail).toEqual([
      ["drift-suggested", "schedule", NOV_25, undefined],
      ["drift-suggestion-cleared", "schedule", NOV_25, "superseded"],
      ["drift-suggested", "calendar", NOV_24, undefined],
      ["drift-suggestion-cleared", "calendar", NOV_24, "no-longer-different"],
      ["drift-suggested", "calendar", NOV_20, undefined],
    ]);
    const applied = get(run(store, decide("calendar", "apply")));
    expect(local(applied.anchorAt)).toBe("2026-11-20 12:00");
    expect(applied.history.at(-1)).toMatchObject({ kind: "calendar-drift-applied", detail: { from: ANCHOR, to: NOV_20 } });
    expect(drifts(applied)).toEqual({ scheduleDrift: undefined, calendarDrift: undefined });
  });
});

describe("move, close and skip require a decision first", () => {
  const pendingSchedule = () => run(base(), wdbme(3));
  const pendingCalendar = () => run(base(), closures("2026-11-30"));

  it("8. moveOccurrence rejects an unresolved schedule drift", () => {
    expect(() => run(pendingSchedule(), move("2026-11-26T11:00:00.000Z"))).toThrow(DomainError);
    expect(() => run(pendingSchedule(), move("2026-11-26T11:00:00.000Z"))).toThrow(/drift-decision-required/);
  });

  it("9. moveOccurrence rejects an unresolved calendar drift", () => {
    expect(() => run(pendingCalendar(), move("2026-11-26T11:00:00.000Z"))).toThrow(/drift-decision-required/);
  });

  it("10. closeOccurrence rejects either unresolved drift", () => {
    expect(() => run(pendingSchedule(), close)).toThrow(/drift-decision-required/);
    expect(() => run(pendingCalendar(), close)).toThrow(/drift-decision-required/);
  });

  it("11. skipOccurrence rejects either unresolved drift", () => {
    expect(() => run(pendingSchedule(), skip)).toThrow(/drift-decision-required/);
    expect(() => run(pendingCalendar(), skip)).toThrow(/drift-decision-required/);
  });

  it("the rejection has a message that tells the user what to do", () => {
    expect(message("error.drift-decision-required")).toBe("A schedule or calendar change suggests another date for this occurrence. Apply or keep it first.");
  });

  it("12. Keep, then close: succeeds and preserves the Keep event", () => {
    const store = run(pendingSchedule(), decide("schedule", "keep"), close);
    const november = get(store);
    expect(november.status).toBe("missed");
    expect(november.anchorAt).toBe(ANCHOR);
    expect(kinds(november).slice(-3)).toEqual(["drift-suggested", "drift-kept", "closed"]);
    expect(november.history.at(-2)).toMatchObject({ kind: "drift-kept", detail: { source: "schedule", suggested: NOV_25, anchorAt: ANCHOR } });
  });

  it("13. Apply, then close: succeeds and preserves the Apply event", () => {
    const schedule = get(run(pendingSchedule(), decide("schedule", "apply"), close));
    expect(kinds(schedule).slice(-3)).toEqual(["drift-suggested", "moved", "closed"]);
    expect(schedule.history.at(-2)).toMatchObject({ kind: "moved", detail: { from: ANCHOR, to: NOV_25, reason: "schedule-changed" } });
    const calendar = get(run(pendingCalendar(), decide("calendar", "apply"), close));
    expect(kinds(calendar).slice(-3)).toEqual(["drift-suggested", "calendar-drift-applied", "closed"]);
  });

  it("14. Apply, then a manual move: succeeds", () => {
    const november = get(run(pendingSchedule(), decide("schedule", "apply"), move("2026-11-26T11:00:00.000Z")));
    expect(november.anchorAt).toBe("2026-11-26T11:00:00.000Z");
    expect(november.originalAnchorAt).toBe(NOV_25);
    expect(kinds(november).slice(-2)).toEqual(["moved", "moved"]);
  });

  it("Keep, then skip, and decisions after Keep still work", () => {
    const november = get(run(pendingCalendar(), decide("calendar", "keep"), skip));
    expect(november.status).toBe("skipped");
  });
});

describe("Apply and Keep", () => {
  it("Apply moves to the current suggestion, recalculates unresolved tasks only and clears the field", () => {
    const store = run(base(), { type: "completeTask", occurrenceId: NOV, taskId: "collect" }, wdbme(3));
    const before = get(store);
    const applied = get(run(store, decide("schedule", "apply")));
    expect(applied.anchorAt).toBe(NOV_25);
    expect(drifts(applied)).toEqual({ scheduleDrift: undefined, calendarDrift: undefined });
    const due = (occurrence: Occurrence, id: string) => occurrence.tasks.find((task) => task.id === id)!.dueAt;
    expect(due(applied, "collect")).toBe(due(before, "collect")); // done: unchanged
    expect(local(due(applied, "check"))).toBe("2026-11-23 16:00"); // −2 WD from 25.11.
  });

  it("Keep leaves anchor and task due dates unchanged and clears the field", () => {
    const store = run(base(), closures("2026-11-30"));
    const kept = get(run(store, decide("calendar", "keep")));
    expect(kept.anchorAt).toBe(ANCHOR);
    expect(kept.tasks).toEqual(get(store).tasks);
    expect(drifts(kept)).toEqual({ scheduleDrift: undefined, calendarDrift: undefined });
  });

  it("a kept date is not suggested again by an unrelated later change", () => {
    const kept = run(base(), wdbme(3), decide("schedule", "keep"));
    const later = run(kept, closures("2026-12-15"));
    expect(get(later)).toBe(get(kept));
    // A different candidate is suggested again.
    const changed = run(kept, wdbme(4));
    expect(added(kept, changed)).toMatchObject([{ kind: "drift-suggested", detail: { suggested: NOV_24 } }]);
  });

  it("a suggestion that leads back to a kept date is withdrawn as already reviewed", () => {
    const store = run(base(), wdbme(3), decide("schedule", "keep"), wdbme(4));
    const after = run(store, wdbme(3));
    expect(added(store, after)).toMatchObject([{ kind: "drift-suggestion-cleared", detail: { suggested: NOV_24, reason: "kept-earlier" } }]);
    expect(drifts(get(after))).toEqual({ scheduleDrift: undefined, calendarDrift: undefined });
  });
});

describe("closed occurrences and working hours", () => {
  it("15. closed or skipped occurrences never retain drift fields and get no drift events", () => {
    const skipped = run(base(), skip);
    const after = run(skipped, wdbme(3), closures("2026-11-30"));
    expect(get(after)).toBe(get(skipped));
    expect(drifts(get(after))).toEqual({ scheduleDrift: undefined, calendarDrift: undefined });
    // A store that has one anyway is rejected by validation.
    const broken: StoreV3 = { ...after, occurrences: after.occurrences.map((occurrence) => (occurrence.id === NOV ? { ...occurrence, calendarDrift: NOV_20 } : occurrence)) };
    expect(findInvariantViolations(broken)).toContain(`occurrence ${NOV}: closed occurrence with a drift suggestion`);
  });

  it("two pending suggestions at once are an invariant violation", () => {
    const store = run(base(), wdbme(3));
    const broken: StoreV3 = { ...store, occurrences: store.occurrences.map((occurrence) => (occurrence.id === NOV ? { ...occurrence, calendarDrift: NOV_20 } : occurrence)) };
    expect(findInvariantViolations(broken)).toContain(`occurrence ${NOV}: more than one pending drift suggestion`);
  });

  it("17. working-hours-only changes leave dates, drift flags and drift history unchanged", () => {
    const store = run(base(), wdbme(3));
    const after = run(store, { type: "updateCalendar", change: { workingHours: { 1: [{ start: "07:00", end: "12:00" }], 2: [{ start: "09:00", end: "11:00" }] } } });
    expect(after.occurrences).toBe(store.occurrences);
    expect(drifts(get(after))).toEqual({ scheduleDrift: NOV_25, calendarDrift: undefined });
  });

  it("not-started occurrences are regenerated, never given a suggestion", () => {
    const after = run(base(), closures());
    expect(drifts(get(after, DEC))).toEqual({ scheduleDrift: undefined, calendarDrift: undefined });
    expect(kinds(get(after, DEC))).toEqual(["generated"]);
  });
});

describe("history messages", () => {
  const context = { taskTitle: (id: string) => id, assigneeName: (ref: string) => ref, playbookTitle: (id: string) => id, formatInstant: formatDateTime };

  it("describes suggested and cleared events", () => {
    const history = get(run(base(), wdbme(3), closures("2026-11-30"))).history;
    expect(history.slice(-3).map((event) => describeHistoryEvent(event, context))).toEqual([
      "Schedule changed: the rule now gives 25.11.2026 12:00 instead of 23.11.2026 12:00. Apply or keep the current date.",
      "Schedule suggestion for 25.11.2026 12:00 withdrawn: a newer change gives another date.",
      "Calendar changed: the rule now gives 24.11.2026 12:00 instead of 23.11.2026 12:00. Apply or keep the current date.",
    ]);
  });
});
