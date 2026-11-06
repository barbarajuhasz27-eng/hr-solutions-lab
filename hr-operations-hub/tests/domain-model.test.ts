/**
 * Domain model v3: type invariants, the shipped Training Session v2 playbook, the synthetic seed and the
 * temporary activity adapter that keeps the M0 screens working on v3 data.
 */
import { describe, expect, it } from "vitest";
import { getReadiness } from "../lib/engine";
import { getPlaybook } from "../lib/playbooks";
import { createSeedActivities } from "../lib/seed";
import { assessOutcome } from "../lib/domain/outcome";
import {
  DomainError,
  instantiateOccurrence,
  isNotStarted,
  occurrenceId,
  resolveDueAt,
} from "../lib/domain/occurrence";
import { responsibleForLegacyRole, TRAINING_SESSION_V2 } from "../lib/domain/playbooks";
import {
  COMPLETED_OCCURRENCE_ID,
  createSeedStore,
  RESCUE_LEAD_MINUTES,
  RESCUE_OCCURRENCE_ID,
  UPCOMING_OCCURRENCE_ID,
} from "../lib/domain/seed";
import type { StoreV3 } from "../lib/domain/types";
import { findInvariantViolations, isStoreV3Shape, parseStoreV3 } from "../lib/domain/validate";
import { toActivities } from "../lib/store/activity-adapter";

const NOW = "2026-11-03T08:00:00.000Z";
const MINUTE = 60_000;
const seed = () => createSeedStore(NOW);

describe("Training Session v2 (Appendix A.1)", () => {
  const legacy = getPlaybook("training-session")!;

  it("keeps the seven existing tasks unchanged, with offsets converted to minutes", () => {
    expect(TRAINING_SESSION_V2).toMatchObject({ id: "training-session", version: 2, area: "LD", status: "available", anchorKind: "event-start", anchorLabel: "Training starts" });
    expect(TRAINING_SESSION_V2.tasks).toHaveLength(7);
    TRAINING_SESSION_V2.tasks.forEach((task, index) => {
      const action = legacy.actions[index];
      expect(task).toMatchObject({
        id: action.id,
        title: action.title,
        description: action.description,
        ownerRole: action.ownerRole,
        criticality: action.criticality,
        estimatedMinutes: action.estimatedMinutes,
        dependsOn: action.dependsOn,
        fallback: action.fallback,
        offset: { amount: action.dueOffsetMinutes, unit: "minutes" },
      });
    });
  });

  it("maps responsibilities as in §11.3", () => {
    for (const task of TRAINING_SESSION_V2.tasks) expect(task.responsible).toEqual(responsibleForLegacyRole(task.ownerRole));
    expect(responsibleForLegacyRole("HR")).toEqual({ kind: "owner" });
    expect(responsibleForLegacyRole("HR / Trainer")).toEqual({ kind: "owner" });
    expect(responsibleForLegacyRole("Facilities")).toEqual({ kind: "counterparty", counterpartyId: "cp-facilities" });
    expect(responsibleForLegacyRole("IT")).toEqual({ kind: "counterparty", counterpartyId: "cp-it" });
    expect(responsibleForLegacyRole("Trainer")).toEqual({ kind: "counterparty", counterpartyId: "cp-trainer" });
  });

  it("uses the event windows: lead time 7 days, attention 24 h, recovery 60 min", () => {
    expect(TRAINING_SESSION_V2.leadTime).toEqual({ amount: 168, unit: "hours" });
    expect(TRAINING_SESSION_V2.attentionWindow).toEqual({ amount: 24, unit: "hours" });
    expect(TRAINING_SESSION_V2.recoveryWindow).toEqual({ amount: 60, unit: "minutes" });
  });
});

describe("synthetic seed (Appendix B, M1 scope)", () => {
  it("is a valid, consistent v3 store", () => {
    const store = seed();
    expect(isStoreV3Shape(store)).toBe(true);
    expect(findInvariantViolations(store)).toEqual([]);
    expect(parseStoreV3(JSON.parse(JSON.stringify(store)))).toEqual(store);
    expect(store).toMatchObject({ version: 3, savedAt: NOW, modified: false });
  });

  it("has the four fictional HR people and nine fictional counterparties", () => {
    const store = seed();
    expect(store.people.map((person) => `${person.name} · ${person.roleTitle}`)).toEqual([
      "Sophie Lang · HR Generalist", "Daniel Hofer · HR Operations Specialist", "Lena Gruber · HR Coordinator", "Katrin Mayr · Head of HR",
    ]);
    expect(store.people.every((person) => person.unavailable.length === 0)).toBe(true);
    expect(store.counterparties.map((item) => item.name)).toEqual([
      "Finance & Controlling", "Sales Operations", "Line managers", "IT Service Desk", "Facilities",
      "External payroll provider", "HR system vendor", "Works council", "External trainer",
    ]);
    expect(store.counterparties.filter((item) => item.contactName).map((item) => item.contactName)).toEqual(["Jonas Weber", "Mara Klein", "Alex Morgan"]);
  });

  it("seeds the work calendar: Mon–Fri 08–12 and 13–17, AT holidays unverified, 24.12. and 31.12. as company closures", () => {
    const { calendar } = seed();
    expect(calendar.timeZone).toBe("Europe/Vienna");
    expect(calendar.workingWeek).toEqual([1, 2, 3, 4, 5]);
    for (const day of [1, 2, 3, 4, 5] as const) expect(calendar.workingHours[day]).toEqual([{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }]);
    expect(calendar.workingHours[6]).toBeUndefined();
    expect(calendar.publicHolidays).toHaveLength(26);
    expect(calendar.publicHolidays.every((holiday) => holiday.verified === false && holiday.source === "ARG § 7 Abs. 2")).toBe(true);
    const holidayDates = calendar.publicHolidays.map((holiday) => holiday.date);
    expect(holidayDates).not.toContain("2026-12-24");
    expect(holidayDates).not.toContain("2026-12-31");
    expect(holidayDates).toContain("2026-11-01");
    expect(holidayDates).toContain("2027-03-29");
    expect(calendar.companyClosures).toEqual([
      { date: "2026-12-24", name: "Demo company closure" },
      { date: "2026-12-31", name: "Demo company closure" },
    ]);
  });

  it("contains only the three one-off training operations; payroll and reporting follow in M5", () => {
    const store = seed();
    expect(store.playbooks.map((playbook) => `${playbook.id}@${playbook.version}`)).toEqual(["training-session@2"]);
    expect(store.operations.map((operation) => operation.title)).toEqual(["Leading through change", "Excel essentials for managers", "HR systems refresher"]);
    expect(store.operations.every((operation) => operation.schedule === null && operation.area === "LD")).toBe(true);
    expect(store.occurrences.every((occurrence) => occurrence.periodKey === "once" && occurrence.id === occurrenceId(occurrence.operationId, "once"))).toBe(true);
  });

  it("keeps the existing demo scenarios: rescue in 45 minutes, partly prepared session in 4 days, closed session 5 days ago", () => {
    const store = seed();
    const byId = (id: string) => store.occurrences.find((occurrence) => occurrence.id === id)!;
    const rescue = byId(RESCUE_OCCURRENCE_ID);
    expect((new Date(rescue.anchorAt).getTime() - new Date(NOW).getTime()) / MINUTE).toBe(RESCUE_LEAD_MINUTES);
    expect(rescue.status).toBe("active");
    expect(rescue.eventDetails).toEqual({ location: "Room 2.14 · HQ" });
    expect(rescue.tasks.every((task) => task.status === "not-started")).toBe(true);

    const upcoming = byId(UPCOMING_OCCURRENCE_ID);
    expect(upcoming.tasks.filter((task) => task.status === "done").map((task) => task.id)).toEqual(["trainer-confirmed", "participants-confirmed", "room-confirmed"]);

    const completed = byId(COMPLETED_OCCURRENCE_ID);
    expect(completed.status).toBe("completed");
    expect(assessOutcome(completed).outcome).toBe("completed");
    expect(completed.history.map((event) => event.kind)).toEqual(["generated", "activated", ...completed.tasks.map(() => "task-completed"), "closed"]);
    // History is in time order.
    const times = completed.history.map((event) => new Date(event.at).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe("occurrence snapshot (§4.3)", () => {
  const store = seed();
  const operation = { id: "op-a", ownerId: "p-lena", backupId: "p-daniel" };

  it("copies tasks with resolved dueAt, owner, backup and playbook version", () => {
    const occurrence = instantiateOccurrence({ operation, playbook: TRAINING_SESSION_V2, periodKey: "once", anchorAt: "2026-11-20T09:00:00.000Z", location: "HQ", now: NOW, actorId: "p-sophie" });
    expect(occurrence).toMatchObject({ id: "op-a:once", ownerId: "p-lena", backupId: "p-daniel", playbookVersion: 2, status: "scheduled" });
    expect(occurrence.tasks.map((task) => task.dueAt)).toEqual(TRAINING_SESSION_V2.tasks.map((template) => resolveDueAt("2026-11-20T09:00:00.000Z", template)));
    expect(isNotStarted(occurrence)).toBe(true);
    // The snapshot is a copy: changing the playbook afterwards does not change the occurrence.
    const playbook = structuredClone(TRAINING_SESSION_V2);
    const copy = instantiateOccurrence({ operation, playbook, periodKey: "once", anchorAt: "2026-11-20T09:00:00.000Z", now: NOW, actorId: "p-sophie" });
    playbook.tasks[0].title = "Changed";
    playbook.tasks[3].dependsOn.push("trainer-confirmed");
    expect(copy.tasks[0].title).toBe("Confirm trainer and session content");
    expect(copy.tasks[3].dependsOn).toEqual(["room-confirmed"]);
    expect(store).toBeDefined();
  });

  it("resolves hours and minutes exactly and leaves working-day offsets to the M2 engine", () => {
    expect(resolveDueAt(NOW, { offset: { amount: -90, unit: "minutes" } })).toBe("2026-11-03T06:30:00.000Z");
    expect(resolveDueAt(NOW, { offset: { amount: 2, unit: "hours" } })).toBe("2026-11-03T10:00:00.000Z");
    expect(() => resolveDueAt(NOW, { offset: { amount: -1, unit: "workingDays" } })).toThrow(DomainError);
    expect(() => resolveDueAt(NOW, { offset: { amount: 1, unit: "calendarDays" } })).toThrow(DomainError);
  });
});

describe("model invariants", () => {
  const broken = (change: (store: StoreV3) => void) => {
    const store = seed();
    change(store);
    return findInvariantViolations(store);
  };

  it.each<[string, (store: StoreV3) => void, RegExp]>([
    ["essential task unassigned", (s) => { s.occurrences[0].tasks[0].responsible = { kind: "unassigned" }; }, /essential task unassigned/],
    ["done without resolvedAt", (s) => { s.occurrences[0].tasks[0].status = "done"; }, /resolvedAt/],
    ["resolvedAt on an open task", (s) => { s.occurrences[0].tasks[0].resolvedAt = NOW; }, /resolvedAt/],
    ["waiting without hold", (s) => { s.occurrences[0].tasks[0].status = "waiting"; }, /hold must be set/],
    ["hold kind differs from status", (s) => { s.occurrences[0].tasks[0].status = "blocked"; s.occurrences[0].tasks[0].hold = { kind: "waiting", since: NOW }; }, /hold kind/],
    ["backup equals owner", (s) => { s.operations[0].backupId = s.operations[0].ownerId; }, /backup equals owner/],
    ["owner is a counterparty", (s) => { s.operations[0].ownerId = "cp-it"; }, /owner is not a person/],
    ["occurrence id format", (s) => { s.occurrences[0].id = "rescue"; }, /operationId:periodKey/],
    ["unknown operation", (s) => { s.occurrences[0].operationId = "op-missing"; }, /unknown operation/],
    ["closed without closedAt", (s) => { s.occurrences[0].status = "completed"; }, /closedAt/],
    ["missed without note", (s) => { s.occurrences[0].status = "missed"; s.occurrences[0].closedAt = NOW; }, /without note/],
    ["unknown dependency", (s) => { s.occurrences[0].tasks[0].dependsOn = ["ghost"]; }, /unknown ghost/],
    ["unknown responsible", (s) => { s.occurrences[0].tasks[0].responsible = { kind: "person", personId: "p-ghost" }; }, /unknown responsible/],
    ["duplicate occurrence", (s) => { s.occurrences.push(s.occurrences[0]); }, /duplicate occurrence/],
    ["unknown playbook version", (s) => { s.operations[0].playbookVersion = 9; }, /unknown playbook/],
  ])("detects: %s", (_label, change, pattern) => {
    expect(broken(change).join("\n")).toMatch(pattern);
  });

  it("rejects malformed shapes", () => {
    expect(isStoreV3Shape(null)).toBe(false);
    expect(isStoreV3Shape({ ...seed(), version: 2 })).toBe(false);
    const badStatus = seed() as unknown as { occurrences: { status: string }[] };
    badStatus.occurrences[0].status = "done";
    expect(isStoreV3Shape(badStatus)).toBe(false);
    const badTime = seed() as unknown as { occurrences: { anchorAt: string }[] };
    badTime.occurrences[0].anchorAt = "tomorrow";
    expect(isStoreV3Shape(badTime)).toBe(false);
    const badDetail = seed() as unknown as { occurrences: { history: { detail: unknown }[] }[] };
    badDetail.occurrences[0].history[0].detail = { nested: { a: 1 } };
    expect(isStoreV3Shape(badDetail)).toBe(false);
  });
});

describe("temporary activity adapter (M0 screens on v3 data)", () => {
  it("presents the seed exactly like the former v2 seed, so the M0 engine gives the same results", () => {
    const fromV3 = toActivities(seed());
    const legacy = createSeedActivities(new Date(NOW));
    const comparable = (items: typeof legacy) =>
      items.map((activity) => ({
        title: activity.title,
        startsAt: activity.startsAt,
        coordinator: activity.coordinator,
        location: activity.location,
        completed: Boolean(activity.completedAt),
        actions: activity.actions.map((action) => ({
          id: action.id, dueOffsetMinutes: action.dueOffsetMinutes, ownerName: action.ownerName, ownerRole: action.ownerRole,
          status: action.status, criticality: action.criticality, dependsOn: action.dependsOn,
        })),
      }));
    expect(comparable(fromV3)).toEqual(comparable(legacy));
    const now = new Date(new Date(NOW).getTime() + 5 * MINUTE);
    expect(fromV3.map((activity) => getReadiness(activity, now).status)).toEqual(legacy.map((activity) => getReadiness(activity, now).status));
  });

  it("uses the occurrence ID and exposes holds, notes and fallbacks to the M0 views", () => {
    const store = seed();
    const rescue = store.occurrences[0];
    rescue.tasks[2] = { ...rescue.tasks[2], status: "waiting", hold: { kind: "waiting", waitingOn: "Facilities", note: "Asked at 09:10", since: NOW } };
    rescue.tasks[0] = { ...rescue.tasks[0], status: "done", resolvedAt: NOW, completionNote: "Fallback used: x", fallbackUsed: true };
    const [activity] = toActivities(store);
    expect(activity.id).toBe(RESCUE_OCCURRENCE_ID);
    expect(activity.actions[2]).toMatchObject({ status: "waiting", waitingOn: "Facilities", statusNote: "Asked at 09:10", ownerName: "Mara Klein" });
    expect(activity.actions[0]).toMatchObject({ status: "done", statusNote: "Fallback used: x", fallbackUsed: true });
  });
});
