/** Generation horizon, idempotency, activation and projection (§6.4). Neutral fixtures. */
import { describe, expect, it } from "vitest";
import { localDateOf, localTimeOf } from "../lib/calendar/dates";
import { applyAction } from "../lib/domain/reducer";
import { CURRENT_USER_ID } from "../lib/domain/seed";
import type { Occurrence, Operation, StoreV3 } from "../lib/domain/types";
import { findInvariantViolations, parseStoreV3 } from "../lib/domain/validate";
import { advanceSchedule, horizonPeriods, projectOccurrences } from "../lib/schedule/generation";
import { monthlySchedule, recurringOperation, storeWith } from "./fixtures/schedule";

// Friday 06.11.2026 10:00 Vienna.
const NOW = "2026-11-06T09:00:00.000Z";
const actor = CURRENT_USER_ID;

const cutoff = () => recurringOperation("op-cutoff", monthlySchedule());
const report = () => recurringOperation("op-report", monthlySchedule({ rule: { kind: "nthWorkingDay", n: 3 }, anchorPeriodOffset: 1, time: "10:00" }));
const weekly = () => recurringOperation("op-weekly", monthlySchedule({ frequency: "weekly", rule: { kind: "weekday", weekday: 1 }, time: "09:00", startDate: "2026-11-01" }));
const quarterly = () => recurringOperation("op-quarterly", monthlySchedule({ frequency: "quarterly", rule: { kind: "monthAndDay", month: 1, day: 15 }, time: "09:00" }));
const annual = () => recurringOperation("op-annual", monthlySchedule({ frequency: "annually", rule: { kind: "monthAndDay", month: 3, day: 31 }, time: "09:00" }));

function generate(operations: Operation[], now = NOW): StoreV3 {
  return advanceSchedule(storeWith(now, operations), now, actor).store;
}

const ofOperation = (store: StoreV3, operationId: string) =>
  store.occurrences.filter((occurrence) => occurrence.operationId === operationId).sort((a, b) => a.anchorAt.localeCompare(b.anchorAt));
const summary = (occurrence: Occurrence) => `${occurrence.periodKey} ${localDateOf(occurrence.anchorAt)} ${localTimeOf(occurrence.anchorAt)}`;

describe("generation horizon", () => {
  it("monthly: the current and next two periods", () => {
    const store = generate([cutoff()]);
    expect(ofOperation(store, "op-cutoff").map(summary)).toEqual([
      "2026-11 2026-11-23 12:00",
      "2026-12 2026-12-21 12:00", // the demo calendar closes on 24.12. and 31.12. (D2)
      "2027-01 2027-01-22 12:00",
    ]);
  });

  it("monthly with anchorPeriodOffset 1: counted on the anchor period, keys stay the covered period", () => {
    expect(ofOperation(generate([report()]), "op-report").map(summary)).toEqual([
      "2026-10 2026-11-04 10:00",
      "2026-11 2026-12-03 10:00",
      "2026-12 2027-01-07 10:00",
    ]);
  });

  it("weekly: up to 90 days ahead, across the 53-week ISO year", () => {
    const occurrences = ofOperation(generate([weekly()]), "op-weekly");
    expect(occurrences).toHaveLength(14);
    expect(occurrences.map((occurrence) => occurrence.periodKey)).toEqual([
      "2026-W45", "2026-W46", "2026-W47", "2026-W48", "2026-W49", "2026-W50", "2026-W51", "2026-W52", "2026-W53",
      "2027-W01", "2027-W02", "2027-W03", "2027-W04", "2027-W05",
    ]);
    expect(summary(occurrences[0])).toBe("2026-W45 2026-11-02 09:00");
    expect(summary(occurrences[13])).toBe("2027-W05 2027-02-01 09:00"); // 06.11. + 90 days = 04.02.2027
  });

  it("quarterly and annual: the current and next period", () => {
    const store = generate([quarterly(), annual()]);
    expect(ofOperation(store, "op-quarterly").map(summary)).toEqual(["2026-Q4 2026-10-15 09:00", "2027-Q1 2027-01-15 09:00"]);
    expect(ofOperation(store, "op-annual").map(summary)).toEqual(["2026 2026-03-31 09:00", "2027 2027-03-31 09:00"]);
  });

  it("covers every frequency in one store and keeps it valid", () => {
    const store = generate([cutoff(), report(), weekly(), quarterly(), annual()]);
    expect(findInvariantViolations(store)).toEqual([]);
    expect(parseStoreV3(JSON.parse(JSON.stringify(store)))).not.toBeNull();
  });

  it("horizon periods for each frequency", () => {
    const keys = (operation: Operation) => horizonPeriods(operation.schedule!, "2026-11-06").map((period) => `${period.year}-${period.index}`);
    expect(keys(cutoff())).toEqual(["2026-11", "2026-12", "2027-1"]);
    expect(keys(report())).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(keys(quarterly())).toEqual(["2026-4", "2027-1"]);
    expect(keys(annual())).toEqual(["2026-1", "2027-1"]);
  });

  it("snapshots tasks with day-based, minute and post-anchor offsets", () => {
    const [november] = ofOperation(generate([cutoff()]), "op-cutoff");
    const due = Object.fromEntries(november.tasks.map((task) => [task.id, `${localDateOf(task.dueAt)} ${localTimeOf(task.dueAt)}`]));
    expect(due).toEqual({
      collect: "2026-11-13 12:00", // −6 WD, anchor time
      check: "2026-11-19 16:00", // −2 WD, dueTime
      submit: "2026-11-23 12:00", // 0 WD
      call: "2026-11-23 10:30", // −90 minutes
      confirm: "2026-11-25 10:00", // +2 WD after the anchor, dueTime
      file: "2026-11-26 12:00", // +3 calendar days, a working day
    });
    expect(november.tasks.find((task) => task.id === "check")!.responsible).toEqual({ kind: "person", personId: "p-daniel" });
    expect(november.history.map((event) => event.kind)).toEqual(["generated"]);
  });

  it("calendar-day offsets that land on a non-working day move to the previous working day", () => {
    const [, december] = ofOperation(generate([cutoff()]), "op-cutoff");
    // Anchor Mon 21.12.; +3 calendar days = Thu 24.12., a company closure → Wed 23.12.
    expect(localDateOf(december.tasks.find((task) => task.id === "file")!.dueAt)).toBe("2026-12-23");
  });

  it("flags impossible rules instead of generating invalid occurrences", () => {
    const tooMany = recurringOperation("op-nth", monthlySchedule({ rule: { kind: "nthWorkingDay", n: 21 } }));
    const result = advanceSchedule(storeWith(NOW, [tooMany]), NOW, actor);
    expect(ofOperation(result.store, "op-nth").map(summary)).toEqual(["2026-11 2026-11-30 12:00"]);
    expect(result.issues).toEqual([
      { operationId: "op-nth", periodKey: "2026-12", issue: "nth-working-day-out-of-range" },
      { operationId: "op-nth", periodKey: "2027-01", issue: "nth-working-day-out-of-range" },
    ]);
  });

  it("does not generate when an essential task needs a backup the operation does not have", () => {
    const result = advanceSchedule(storeWith(NOW, [recurringOperation("op-x", monthlySchedule(), { backupId: undefined })]), NOW, actor);
    expect(ofOperation(result.store, "op-x")).toEqual([]);
    expect(result.issues.map((issue) => issue.issue)).toEqual(["backup-required", "backup-required", "backup-required"]);
  });
});

describe("idempotency", () => {
  it("a second run with the same time changes nothing and returns the same store", () => {
    const first = generate([cutoff(), weekly()]);
    const second = advanceSchedule(first, NOW, actor);
    expect(second.store).toBe(first);
    expect(second.generated).toEqual([]);
  });

  it("later runs add only new periods; ids stay unique", () => {
    let store = generate([cutoff(), weekly()]);
    for (const day of ["2026-11-13", "2026-12-01", "2026-12-02", "2027-01-04"]) {
      store = advanceSchedule(store, `${day}T09:00:00.000Z`, actor).store;
      store = advanceSchedule(store, `${day}T09:00:30.000Z`, actor).store;
    }
    const ids = store.occurrences.map((occurrence) => occurrence.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ofOperation(store, "op-cutoff").map((occurrence) => occurrence.periodKey)).toEqual(["2026-11", "2026-12", "2027-01", "2027-02", "2027-03"]);
    expect(findInvariantViolations(store)).toEqual([]);
  });

  it("never regenerates an occurrence the visitor already changed or closed", () => {
    let store = generate([cutoff()]);
    const ctx = { now: "2026-11-10T09:00:00.000Z", actorId: actor };
    store = applyAction(store, { type: "skipOccurrence", occurrenceId: "op-cutoff:2026-11", reason: "Provider holiday" }, ctx);
    store = advanceSchedule(store, "2026-11-11T09:00:00.000Z", actor).store;
    expect(store.occurrences.find((occurrence) => occurrence.id === "op-cutoff:2026-11")!.status).toBe("skipped");
    expect(store.occurrences.filter((occurrence) => occurrence.id === "op-cutoff:2026-11")).toHaveLength(1);
  });
});

describe("activation", () => {
  // Lead time 10 WD before Mon 23.11. → Mon 09.11. 00:00 Vienna; the first task is due 13.11.
  const ACTIVE_FROM = "2026-11-08T23:00:00.000Z";

  it("stays scheduled until anchor − leadTime or the first task due date, whichever is earlier", () => {
    const store = generate([cutoff()]);
    expect(ofOperation(store, "op-cutoff").map((occurrence) => occurrence.status)).toEqual(["scheduled", "scheduled", "scheduled"]);
    const justBefore = advanceSchedule(store, "2026-11-08T22:59:00.000Z", actor);
    expect(justBefore.activated).toEqual([]);
    const atStart = advanceSchedule(store, ACTIVE_FROM, actor);
    expect(atStart.activated).toEqual(["op-cutoff:2026-11"]);
    const november = ofOperation(atStart.store, "op-cutoff")[0];
    expect(november.status).toBe("active");
    expect(november.history.at(-1)).toMatchObject({ kind: "activated", at: ACTIVE_FROM, actorId: actor, detail: { activeFrom: ACTIVE_FROM } });
  });

  it("uses the first task's due date when it comes before the lead time", () => {
    const early = recurringOperation("op-early", monthlySchedule());
    const store = storeWith(NOW, [early]);
    const playbook = store.playbooks.find((item) => item.id === "fixture-deadline")!;
    const shortLead = { ...store, playbooks: store.playbooks.map((item) => (item === playbook ? { ...item, leadTime: { amount: 1, unit: "workingDays" as const } } : item)) };
    const generated = advanceSchedule(shortLead, NOW, actor).store;
    // Lead time 1 WD → 20.11. 00:00, but "collect" is due 13.11. 12:00.
    expect(advanceSchedule(generated, "2026-11-13T10:59:00.000Z", actor).activated).toEqual([]);
    expect(advanceSchedule(generated, "2026-11-13T11:00:00.000Z", actor).activated).toEqual(["op-early:2026-11"]);
  });

  it("adds exactly one activated event, however often the engine runs", () => {
    let store = generate([cutoff()]);
    for (const at of ["2026-11-09T08:00:00.000Z", "2026-11-09T08:00:30.000Z", "2026-11-20T08:00:00.000Z"]) store = advanceSchedule(store, at, actor).store;
    const november = ofOperation(store, "op-cutoff")[0];
    expect(november.history.filter((event) => event.kind === "activated")).toHaveLength(1);
  });

  it("an occurrence generated after its lead time started is active at once, with generated then activated", () => {
    const store = generate([report()]);
    const october = ofOperation(store, "op-report")[0];
    expect(october.status).toBe("active");
    expect(october.history.map((event) => event.kind)).toEqual(["generated", "activated"]);
    expect(october.history[1].at).toBe(NOW);
  });

  it("activates one-off occurrences too, and does not mark the demo as modified", () => {
    const store = storeWith(NOW, []);
    const result = advanceSchedule(store, NOW, actor);
    expect(result.store.modified).toBe(false);
  });

  it("is exposed as the advanceSchedule action", () => {
    const store = storeWith(NOW, [cutoff()]);
    const next = applyAction(store, { type: "advanceSchedule" }, { now: NOW, actorId: actor });
    expect(ofOperation(next, "op-cutoff")).toHaveLength(3);
    expect(next.modified).toBe(false);
    expect(applyAction(next, { type: "advanceSchedule" }, { now: NOW, actorId: actor })).toBe(next);
  });
});

describe("operation status, start and end dates", () => {
  it("paused and retired operations generate nothing; existing occurrences remain and can be skipped", () => {
    let store = generate([cutoff()]);
    const ctx = { now: NOW, actorId: actor };
    store = applyAction(store, { type: "setOperationStatus", operationId: "op-cutoff", status: "paused" }, ctx);
    const later = advanceSchedule(store, "2027-02-01T09:00:00.000Z", actor).store;
    expect(ofOperation(later, "op-cutoff").map((occurrence) => occurrence.periodKey)).toEqual(["2026-11", "2026-12", "2027-01"]);
    const skipped = applyAction(later, { type: "skipOccurrence", occurrenceId: "op-cutoff:2027-01", reason: "Paused" }, ctx);
    expect(skipped.occurrences.find((occurrence) => occurrence.id === "op-cutoff:2027-01")!.status).toBe("skipped");
    expect(ofOperation(generate([recurringOperation("op-r", monthlySchedule(), { status: "retired" })]), "op-r")).toEqual([]);
    // Resuming generates the missing periods.
    const resumed = applyAction(later, { type: "setOperationStatus", operationId: "op-cutoff", status: "active" }, ctx);
    expect(ofOperation(advanceSchedule(resumed, "2027-02-01T09:00:00.000Z", actor).store, "op-cutoff").map((o) => o.periodKey)).toEqual([
      "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04",
    ]);
  });

  it("respects startDate and endDate", () => {
    const bounded = recurringOperation("op-b", monthlySchedule({ startDate: "2026-12-01", endDate: "2027-01-15" }));
    expect(ofOperation(generate([bounded]), "op-b").map((occurrence) => occurrence.periodKey)).toEqual(["2026-12"]);
  });

  it("respects the interval", () => {
    const everySecond = recurringOperation("op-2", monthlySchedule({ interval: 2, startDate: "2026-01-01" }));
    expect(ofOperation(generate([everySecond]), "op-2").map((occurrence) => occurrence.periodKey)).toEqual(["2026-11", "2027-01"]);
  });
});

describe("projection", () => {
  it("computes occurrences beyond the horizon on demand, without tasks and without storing them", () => {
    const store = generate([cutoff()]);
    const before = JSON.stringify(store);
    const projected = projectOccurrences(store, "2026-11-01", "2027-04-30");
    expect(projected.map((item) => `${item.periodKey} ${item.anchorDate}`)).toEqual(["2027-02 2027-02-19", "2027-03 2027-03-23", "2027-04 2027-04-23"]); // 29.03.2027 is Easter Monday
    expect(projected.every((item) => item.projected === true && !("tasks" in item))).toBe(true);
    expect(JSON.stringify(store)).toBe(before);
  });

  it("follows the rules, the calendar and the operation's status", () => {
    const store = generate([cutoff(), weekly()]);
    const projected = projectOccurrences(store, "2027-02-02", "2027-02-28");
    expect(projected.filter((item) => item.operationId === "op-weekly").map((item) => item.periodKey)).toEqual(["2027-W06", "2027-W07", "2027-W08"]); // Mondays 08., 15., 22.02.
    expect(projected.find((item) => item.operationId === "op-cutoff")).toMatchObject({ anchorAt: "2027-02-19T11:00:00.000Z", projected: true });
    const paused = { ...store, operations: store.operations.map((operation) => ({ ...operation, status: "paused" as const })) };
    expect(projectOccurrences(paused, "2027-02-02", "2027-02-28")).toEqual([]);
  });

  it("marks weekend-shifted projections with their nominal rule date", () => {
    const shifted = recurringOperation("op-s", monthlySchedule({ rule: { kind: "dayOfMonth", day: 1 }, weekendShift: "next-working-day", time: "09:00" }));
    const [may] = projectOccurrences(storeWith(NOW, [shifted]), "2027-05-01", "2027-05-31");
    // 01.05.2027 is a Saturday and a holiday.
    expect(may).toMatchObject({ periodKey: "2027-05", anchorDate: "2027-05-03", nominalDate: "2027-05-01", shifted: true });
  });
});

describe("stale demo with recurring operations (§11.4)", () => {
  it("recurring occurrences keep their calendar dates and the current periods are generated on load", async () => {
    const { resolveStore } = await import("../lib/store/persistence");
    const left = { ...generate([cutoff()]), modified: true, savedAt: NOW };
    const back = "2027-02-10T09:00:00.000Z";
    const resolved = resolveStore({ v3: JSON.stringify(left), v2: null, v1: null }, back);
    expect(resolved.source).toBe("v3-stale-shifted");
    expect(ofOperation(resolved.store, "op-cutoff").map(summary)).toEqual(ofOperation(left, "op-cutoff").map(summary));
    const loaded = advanceSchedule(resolved.store, back, actor).store;
    expect(ofOperation(loaded, "op-cutoff").map((occurrence) => occurrence.periodKey)).toEqual([
      "2026-11", "2026-12", "2027-01", "2027-02", "2027-03", "2027-04",
    ]);
    expect(findInvariantViolations(loaded)).toEqual([]);
  });
});
