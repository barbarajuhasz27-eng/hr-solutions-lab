/** Schedule changes (§6.6), work-calendar changes (§6.7), drift decisions and moves (§6.5). Neutral fixtures. */
import { describe, expect, it } from "vitest";
import { localDateOf, localTimeOf } from "../lib/calendar/dates";
import { DomainError } from "../lib/domain/errors";
import { isNotStarted } from "../lib/domain/occurrence";
import { applyAction, type HubAction } from "../lib/domain/reducer";
import { CURRENT_USER_ID, RESCUE_OCCURRENCE_ID, RESCUE_OPERATION_ID } from "../lib/domain/seed";
import type { Occurrence, StoreV3 } from "../lib/domain/types";
import { findInvariantViolations } from "../lib/domain/validate";
import { formatDateTime } from "../lib/format";
import { describeHistoryEvent, message } from "../lib/messages/en";
import { advanceSchedule } from "../lib/schedule/generation";
import { monthlySchedule, recurringOperation, storeWith } from "./fixtures/schedule";

const GENERATED_AT = "2026-11-06T09:00:00.000Z";
// Tue 10.11.2026: the November occurrence is active (its lead time started on 09.11.).
const NOW = "2026-11-10T09:00:00.000Z";
const ctx = { now: NOW, actorId: CURRENT_USER_ID };
const NOV = "op-cutoff:2026-11";
const DEC = "op-cutoff:2026-12";
const JAN = "op-cutoff:2027-01";

function base(): StoreV3 {
  const store = advanceSchedule(storeWith(GENERATED_AT, [recurringOperation("op-cutoff", monthlySchedule())]), GENERATED_AT, CURRENT_USER_ID).store;
  return advanceSchedule(store, NOW, CURRENT_USER_ID).store;
}

const run = (store: StoreV3, ...actions: HubAction[]) => actions.reduce((state, action) => applyAction(state, action, ctx), store);
const get = (store: StoreV3, id: string) => store.occurrences.find((occurrence) => occurrence.id === id)!;
const local = (iso: string | undefined) => (iso ? `${localDateOf(iso)} ${localTimeOf(iso)}` : undefined);
const due = (occurrence: Occurrence, taskId: string) => local(occurrence.tasks.find((task) => task.id === taskId)!.dueAt);

describe("starting point", () => {
  it("November is active (started); December and January are not started", () => {
    const store = base();
    expect(get(store, NOV).status).toBe("active");
    expect(isNotStarted(get(store, NOV))).toBe(false);
    expect([DEC, JAN].map((id) => isNotStarted(get(store, id)))).toEqual([true, true]);
    expect([NOV, DEC, JAN].map((id) => local(get(store, id).anchorAt))).toEqual(["2026-11-23 12:00", "2026-12-21 12:00", "2027-01-22 12:00"]);
  });
});

describe("§6.6 schedule change", () => {
  const toThree = (effectiveFrom: string): HubAction => ({
    type: "updateSchedule",
    operationId: "op-cutoff",
    change: { rule: { kind: "workingDaysBeforeMonthEnd", n: 3 } },
    effectiveFrom,
  });

  it("creates a ScheduleVersion; occurrences before effectiveFrom are untouched; not-started ones on or after it are regenerated", () => {
    const before = base();
    const after = run(before, toThree("2026-12-01"));
    const schedule = after.operations.find((operation) => operation.id === "op-cutoff")!.schedule!;
    expect(schedule.versions.map((version) => version.effectiveFrom)).toEqual(["2026-01-01", "2026-12-01"]);
    expect(get(after, NOV)).toBe(get(before, NOV));
    expect(local(get(after, DEC).anchorAt)).toBe("2026-12-23 12:00");
    expect(local(get(after, JAN).anchorAt)).toBe("2027-01-26 12:00");
    expect(get(after, DEC).history).toMatchObject([{ kind: "generated", detail: { reason: "schedule-changed" } }]);
    expect(due(get(after, DEC), "collect")).toBe("2026-12-15 12:00"); // −6 WD from 23.12.: 22., 21., 18., 17., 16., 15.
    expect(after.modified).toBe(true);
    expect(findInvariantViolations(after)).toEqual([]);
  });

  it("keeps started occurrences and stores the new date as a schedule-drift suggestion", () => {
    const after = run(base(), toThree("2026-11-01"));
    const november = get(after, NOV);
    expect(local(november.anchorAt)).toBe("2026-11-23 12:00");
    expect(local(november.scheduleDrift)).toBe("2026-11-25 12:00");
    expect(message("schedule.drift", { date: "25.11.2026" })).toBe("Schedule changed: new rule gives 25.11.2026");
    expect(november.history.map((event) => event.kind)).toEqual(["generated", "activated"]);
  });

  it("Apply new date moves the occurrence with move semantics and logs it; resolved tasks keep their due dates", () => {
    let store = run(base(), { type: "completeTask", occurrenceId: NOV, taskId: "collect" }, toThree("2026-11-01"));
    store = run(store, { type: "decideDrift", occurrenceId: NOV, kind: "schedule", decision: "apply" });
    const november = get(store, NOV);
    expect(local(november.anchorAt)).toBe("2026-11-25 12:00");
    expect(november.scheduleDrift).toBeUndefined();
    expect(november.originalAnchorAt).toBeUndefined();
    expect(due(november, "collect")).toBe("2026-11-13 12:00"); // done: unchanged
    expect(due(november, "check")).toBe("2026-11-23 16:00"); // −2 WD from 25.11.
    const event = november.history.at(-1)!;
    expect(event).toMatchObject({ kind: "moved", at: NOW, actorId: CURRENT_USER_ID, detail: { from: "2026-11-23T11:00:00.000Z", to: "2026-11-25T11:00:00.000Z", reason: "schedule-changed" } });
    expect(describeHistoryEvent(event, { taskTitle: (id) => id, assigneeName: (ref) => ref, playbookTitle: (id) => id, formatInstant: formatDateTime })).toBe(
      "Schedule change applied: anchor moved from 23.11.2026 12:00 to 25.11.2026 12:00.",
    );
  });

  it("Keep clears the suggestion without moving and logs drift-kept", () => {
    const store = run(base(), toThree("2026-11-01"), { type: "decideDrift", occurrenceId: NOV, kind: "schedule", decision: "keep" });
    const november = get(store, NOV);
    expect(local(november.anchorAt)).toBe("2026-11-23 12:00");
    expect(november.scheduleDrift).toBeUndefined();
    expect(november.history.at(-1)).toMatchObject({ kind: "drift-kept", detail: { source: "schedule", suggested: "2026-11-25T11:00:00.000Z" } });
    expect(() => run(store, { type: "decideDrift", occurrenceId: NOV, kind: "schedule", decision: "keep" })).toThrow(DomainError);
  });

  it("never touches closed or skipped occurrences", () => {
    const skipped = run(base(), { type: "skipOccurrence", occurrenceId: NOV, reason: "Provider closed" });
    const after = run(skipped, toThree("2026-11-01"));
    expect(get(after, NOV)).toBe(get(skipped, NOV));
  });

  it("later periods are generated with the new rule; earlier periods resolve with the old one", () => {
    let store = run(base(), toThree("2026-12-01"));
    store = advanceSchedule(store, "2027-01-04T09:00:00.000Z", CURRENT_USER_ID).store;
    expect(local(get(store, "op-cutoff:2027-02").anchorAt)).toBe("2027-02-23 12:00");
    expect(local(get(store, "op-cutoff:2027-03").anchorAt)).toBe("2027-03-25 12:00"); // L 31.03., back 30., 26., 25. (29.03. Easter Monday)
  });

  it("rejects invalid changes and one-off operations", () => {
    expect(() => run(base(), { type: "updateSchedule", operationId: "op-cutoff", change: { interval: 0 }, effectiveFrom: "2026-12-01" })).toThrow(DomainError);
    expect(() => run(base(), { type: "updateSchedule", operationId: RESCUE_OPERATION_ID, change: { time: "10:00" }, effectiveFrom: "2026-12-01" })).toThrow(/not-recurring/);
  });
});

describe("§6.7 work-calendar change", () => {
  const removeClosures: HubAction = { type: "updateCalendar", change: { companyClosures: [] } };

  it("recalculates not-started occurrences: anchor and task due dates", () => {
    const before = base();
    const after = run(before, removeClosures);
    expect(local(get(after, DEC).anchorAt)).toBe("2026-12-23 12:00"); // D1 instead of D2
    expect(due(get(after, DEC), "confirm")).toBe("2026-12-28 10:00"); // +2 WD: 24.12., 28.12.
    expect(get(after, DEC).history).toMatchObject([{ kind: "generated", detail: { reason: "calendar-changed" } }]);
    // Nothing changed for January and for the one-off training sessions.
    expect(get(after, JAN)).toBe(get(before, JAN));
    expect(get(after, RESCUE_OCCURRENCE_ID)).toBe(get(before, RESCUE_OCCURRENCE_ID));
    expect(after.calendar.updatedAt).toBe(NOW);
    expect(findInvariantViolations(after)).toEqual([]);
  });

  it("started occurrences get calendarDrift; Apply moves the anchor (calendar-drift-applied), Keep clears the flag", () => {
    let store = run(base(), { type: "setHold", occurrenceId: DEC, taskId: "collect", hold: { kind: "waiting", waitingOn: "Finance" } });
    store = run(store, removeClosures);
    const december = get(store, DEC);
    expect(local(december.anchorAt)).toBe("2026-12-21 12:00");
    expect(local(december.calendarDrift)).toBe("2026-12-23 12:00");
    expect(message("calendar.drift", { date: "23.12.2026" })).toBe("Calendar changed: rule now gives 23.12.2026");

    const applied = get(run(store, { type: "decideDrift", occurrenceId: DEC, kind: "calendar", decision: "apply" }), DEC);
    expect(local(applied.anchorAt)).toBe("2026-12-23 12:00");
    expect(applied.calendarDrift).toBeUndefined();
    expect(applied.history.at(-1)).toMatchObject({ kind: "calendar-drift-applied", detail: { from: "2026-12-21T11:00:00.000Z", to: "2026-12-23T11:00:00.000Z" } });
    expect(due(applied, "check")).toBe("2026-12-21 16:00"); // −2 WD from 23.12.

    const kept = get(run(store, { type: "decideDrift", occurrenceId: DEC, kind: "calendar", decision: "keep" }), DEC);
    expect(local(kept.anchorAt)).toBe("2026-12-21 12:00");
    expect(kept.calendarDrift).toBeUndefined();
    expect(kept.history.at(-1)).toMatchObject({ kind: "drift-kept", detail: { source: "calendar" } });
  });

  it("clears a drift flag when the calendar changes back", () => {
    let store = run(base(), { type: "updateCalendar", change: { companyClosures: [{ date: "2026-11-30", name: "Closure" }] } });
    expect(local(get(store, NOV).calendarDrift)).toBe("2026-11-20 12:00");
    store = run(store, { type: "updateCalendar", change: { companyClosures: [] } });
    expect(get(store, NOV).calendarDrift).toBeUndefined();
  });

  it("never recalculates closed or skipped occurrences", () => {
    const skipped = run(base(), { type: "skipOccurrence", occurrenceId: NOV, reason: "Provider closed" });
    const after = run(skipped, { type: "updateCalendar", change: { companyClosures: [{ date: "2026-11-30", name: "Closure" }] } });
    expect(get(after, NOV)).toBe(get(skipped, NOV));
  });

  it("a public-holiday change recalculates too; new or edited holidays start unverified", () => {
    const store = base();
    const verifiedStore: StoreV3 = { ...store, calendar: { ...store.calendar, publicHolidays: store.calendar.publicHolidays.map((holiday) => ({ ...holiday, verified: holiday.date.startsWith("2026") })) } };
    const holidays = [...verifiedStore.calendar.publicHolidays, { date: "2026-12-15", name: "Test holiday", source: "Test", verified: true }]
      .map((holiday) => (holiday.date === "2026-12-25" ? { ...holiday, name: "Renamed" } : holiday));
    const after = run(verifiedStore, { type: "updateCalendar", change: { publicHolidays: holidays } });
    const byDate = Object.fromEntries(after.calendar.publicHolidays.map((holiday) => [holiday.date, holiday.verified]));
    expect(byDate["2026-01-01"]).toBe(true); // unchanged and verified: stays verified
    expect(byDate["2026-12-15"]).toBe(false); // new entry: verification is a separate step
    expect(byDate["2026-12-25"]).toBe(false); // edited entry
    expect(byDate["2027-01-01"]).toBe(false);
    // 15.12. is no longer a working day: December's −6 WD task moves from 11.12. to 10.12.; the anchor stays 21.12.
    expect(due(get(store, DEC), "collect")).toBe("2026-12-11 12:00");
    expect(due(get(after, DEC), "collect")).toBe("2026-12-10 12:00");
    expect(local(get(after, DEC).anchorAt)).toBe("2026-12-21 12:00");
  });

  it("a working-week change moves dates; a working-hours change does not", () => {
    const sixDays = run(base(), { type: "updateCalendar", change: { workingWeek: [1, 2, 3, 4, 5, 6] } });
    // January 2027 with Saturdays: L = Sat 30.01., back 29., 28., 27., 26., 25.
    expect(local(get(sixDays, JAN).anchorAt)).toBe("2027-01-25 12:00");
    // November is started: L = Mon 30.11., back Sat 28., 27., 26., 25., 24. → a suggestion only.
    expect(local(get(sixDays, NOV).anchorAt)).toBe("2026-11-23 12:00");
    expect(local(get(sixDays, NOV).calendarDrift)).toBe("2026-11-24 12:00");
    const before = base();
    const hoursOnly = run(before, { type: "updateCalendar", change: { workingHours: { 1: [{ start: "09:00", end: "11:00" }] } } });
    expect(hoursOnly.occurrences).toBe(before.occurrences);
  });

  it.each<[string, HubAction]>([
    ["an empty working week", { type: "updateCalendar", change: { workingWeek: [] } }],
    ["overlapping working hours", { type: "updateCalendar", change: { workingHours: { 1: [{ start: "08:00", end: "12:00" }, { start: "11:00", end: "13:00" }] } } }],
    ["an interval that ends before it starts", { type: "updateCalendar", change: { workingHours: { 2: [{ start: "13:00", end: "12:00" }] } } }],
    ["a duplicate closure", { type: "updateCalendar", change: { companyClosures: [{ date: "2026-12-24", name: "A" }, { date: "2026-12-24", name: "B" }] } }],
    ["an invalid date", { type: "updateCalendar", change: { companyClosures: [{ date: "2026-02-30", name: "A" }] } }],
  ])("rejects %s", (_label, action) => {
    expect(() => run(base(), action)).toThrow(/invalid-calendar/);
  });
});

describe("§6.5 move", () => {
  it("a move onto a non-working day requires confirmation", () => {
    const saturday = "2026-11-21T11:00:00.000Z";
    expect(() => run(base(), { type: "moveOccurrence", occurrenceId: NOV, anchorAt: saturday })).toThrow(/non-working-day/);
    const moved = get(run(base(), { type: "moveOccurrence", occurrenceId: NOV, anchorAt: saturday, confirmNonWorkingDay: true }), NOV);
    expect(moved.history.at(-1)).toMatchObject({ kind: "moved", detail: { nonWorkingDayConfirmed: true } });
    // The non-working anchor is still position 0: −2 WD is Thu 19.11.
    expect(due(moved, "check")).toBe("2026-11-19 16:00");
    expect(local(moved.originalAnchorAt)).toBe("2026-11-23 12:00");
  });

  it("a move onto a working day needs no confirmation and recalculates working-day due dates", () => {
    const moved = get(run(base(), { type: "moveOccurrence", occurrenceId: NOV, anchorAt: "2026-11-27T11:00:00.000Z" }), NOV);
    expect(due(moved, "collect")).toBe("2026-11-19 12:00");
    expect(due(moved, "confirm")).toBe("2026-12-01 10:00");
  });

  it("moving a scheduled occurrence into its lead time activates it with an activated event", () => {
    const moved = get(run(base(), { type: "moveOccurrence", occurrenceId: DEC, anchorAt: "2026-11-16T11:00:00.000Z" }), DEC);
    expect(moved.status).toBe("active");
    expect(moved.history.map((event) => event.kind)).toEqual(["generated", "moved", "activated"]);
  });
});
