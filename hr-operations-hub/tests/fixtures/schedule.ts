/**
 * Neutral fixtures for the M2 schedule engine. The deadline playbook below is a generic test playbook,
 * not one of the approved payroll or reporting playbooks (those are authored in M5).
 */
import { defaultWorkCalendar } from "../../lib/calendar/work-calendar";
import { createSeedStore } from "../../lib/domain/seed";
import type { Operation, Playbook, Schedule, StoreV3, WorkCalendar } from "../../lib/domain/types";

export const FIXTURE_PLAYBOOK_ID = "fixture-deadline";

/** Deadline playbook with working-day, calendar-day and minute offsets, pre- and post-anchor tasks. */
export const FIXTURE_PLAYBOOK: Playbook = {
  id: FIXTURE_PLAYBOOK_ID,
  version: 1,
  title: "Fixture deadline",
  area: "PG",
  status: "available",
  purpose: "Neutral test playbook.",
  trigger: "Test schedule.",
  anchorKind: "deadline",
  anchorLabel: "Deadline",
  leadTime: { amount: 10, unit: "workingDays" },
  attentionWindow: { amount: 2, unit: "workingDays" },
  recoveryWindow: { amount: 1, unit: "workingDays" },
  completionCriteria: ["Submitted"],
  tasks: [
    { id: "collect", title: "Collect", description: "", offset: { amount: -6, unit: "workingDays" }, ownerRole: "HR", responsible: { kind: "owner" }, criticality: "essential", estimatedMinutes: 60, dependsOn: [] },
    { id: "check", title: "Check", description: "", offset: { amount: -2, unit: "workingDays" }, dueTime: "16:00", ownerRole: "HR", responsible: { kind: "backup" }, criticality: "essential", estimatedMinutes: 30, dependsOn: ["collect"] },
    { id: "submit", title: "Submit", description: "", offset: { amount: 0, unit: "workingDays" }, ownerRole: "HR", responsible: { kind: "owner" }, criticality: "essential", estimatedMinutes: 15, dependsOn: ["check"] },
    { id: "call", title: "Call", description: "", offset: { amount: -90, unit: "minutes" }, ownerRole: "HR", responsible: { kind: "owner" }, criticality: "optional", estimatedMinutes: 5, dependsOn: [] },
    { id: "confirm", title: "Confirm", description: "", offset: { amount: 2, unit: "workingDays" }, dueTime: "10:00", ownerRole: "HR", responsible: { kind: "owner" }, criticality: "important", estimatedMinutes: 10, dependsOn: ["submit"] },
    { id: "file", title: "File", description: "", offset: { amount: 3, unit: "calendarDays" }, ownerRole: "HR", responsible: { kind: "owner" }, criticality: "optional", estimatedMinutes: 10, dependsOn: [] },
  ],
};

/** The fictional demo provider's cut-off from §6.2a: `workingDaysBeforeMonthEnd(5)` at 12:00. */
export function monthlySchedule(overrides: Partial<Schedule> = {}): Schedule {
  return {
    frequency: "monthly",
    interval: 1,
    rule: { kind: "workingDaysBeforeMonthEnd", n: 5 },
    anchorPeriodOffset: 0,
    time: "12:00",
    weekendShift: "none",
    startDate: "2026-01-01",
    versions: [],
    ...overrides,
  };
}

export function recurringOperation(id: string, schedule: Schedule, overrides: Partial<Operation> = {}): Operation {
  return {
    id,
    title: `Fixture ${id}`,
    area: "PG",
    playbookId: FIXTURE_PLAYBOOK_ID,
    playbookVersion: 1,
    ownerId: "p-sophie",
    backupId: "p-daniel",
    schedule,
    status: "active",
    createdAt: "2026-01-01T08:00:00.000Z",
    ...overrides,
  };
}

/** The synthetic seed plus the fixture playbook and the given recurring operations. */
export function storeWith(now: string, operations: Operation[], calendar?: Partial<WorkCalendar>): StoreV3 {
  const seed = createSeedStore(now);
  return {
    ...seed,
    calendar: { ...seed.calendar, ...calendar },
    playbooks: [...seed.playbooks, FIXTURE_PLAYBOOK],
    operations: [...seed.operations, ...operations],
  };
}

/** Work-calendar variants of §6.2a: AT holidays, Mon–Fri, with or without the December closures. */
export function calendarWithClosures(closures: string[]): WorkCalendar {
  return { ...defaultWorkCalendar("2026-11-01T00:00:00.000Z"), companyClosures: closures.map((date) => ({ date, name: "Closure" })) };
}
