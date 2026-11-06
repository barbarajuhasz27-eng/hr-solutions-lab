/**
 * Synthetic v3 seed, built relative to the current date (Appendix B). All people and counterparties are
 * fictional. No real employee data.
 *
 * M1 scope: people, counterparties, the work calendar and the three one-off Training Session operations
 * (the existing demo scenarios). The payroll and HR reporting operations need the approved playbooks and
 * the schedule engine; they are seeded in M5. Unavailability for the cover flow is seeded with M4.
 */
import { COUNTERPARTY_IDS, shippedPlaybooks, TRAINING_PLAYBOOK_ID } from "./playbooks";
import {
  addMinutes,
  historyEvent,
  instantiateOccurrence,
  leadTimeStart,
  ONE_OFF_PERIOD_KEY,
  openStatusAt,
  occurrenceId,
  toInstant,
} from "./occurrence";
import type { Counterparty, ISODateTime, Occurrence, Operation, Person, Playbook, PublicHoliday, StoreV3, Task, WorkCalendar } from "./types";

/** The simulated current user (§3). */
export const CURRENT_USER_ID = "p-sophie";

export const PEOPLE: Person[] = [
  { id: "p-sophie", name: "Sophie Lang", roleTitle: "HR Generalist", unavailable: [] },
  { id: "p-daniel", name: "Daniel Hofer", roleTitle: "HR Operations Specialist", unavailable: [] },
  { id: "p-lena", name: "Lena Gruber", roleTitle: "HR Coordinator", unavailable: [] },
  { id: "p-katrin", name: "Katrin Mayr", roleTitle: "Head of HR", unavailable: [] },
];

export const COUNTERPARTIES: Counterparty[] = [
  { id: COUNTERPARTY_IDS.finance, name: "Finance & Controlling", kind: "internal-team" },
  { id: COUNTERPARTY_IDS.salesOps, name: "Sales Operations", kind: "internal-team" },
  { id: COUNTERPARTY_IDS.lineManagers, name: "Line managers", kind: "manager-group" },
  { id: COUNTERPARTY_IDS.it, name: "IT Service Desk", kind: "internal-team", contactName: "Jonas Weber" },
  { id: COUNTERPARTY_IDS.facilities, name: "Facilities", kind: "internal-team", contactName: "Mara Klein" },
  { id: COUNTERPARTY_IDS.payrollProvider, name: "External payroll provider", kind: "external-provider" },
  { id: COUNTERPARTY_IDS.hrisVendor, name: "HR system vendor", kind: "external-provider" },
  { id: COUNTERPARTY_IDS.worksCouncil, name: "Works council", kind: "internal-team" },
  { id: COUNTERPARTY_IDS.trainer, name: "External trainer", kind: "external-provider", contactName: "Alex Morgan" },
];

const ARG = "ARG § 7 Abs. 2";

/** Austrian statutory public holidays 2026–2027 (§6.1), entered by hand and not yet verified against RIS. */
const HOLIDAYS: [string, string][] = [
  ["2026-01-01", "Neujahr"], ["2026-01-06", "Heilige Drei Könige"], ["2026-04-06", "Ostermontag"],
  ["2026-05-01", "Staatsfeiertag"], ["2026-05-14", "Christi Himmelfahrt"], ["2026-05-25", "Pfingstmontag"],
  ["2026-06-04", "Fronleichnam"], ["2026-08-15", "Mariä Himmelfahrt"], ["2026-10-26", "Nationalfeiertag"],
  ["2026-11-01", "Allerheiligen"], ["2026-12-08", "Mariä Empfängnis"], ["2026-12-25", "Christtag"],
  ["2026-12-26", "Stefanitag"],
  ["2027-01-01", "Neujahr"], ["2027-01-06", "Heilige Drei Könige"], ["2027-03-29", "Ostermontag"],
  ["2027-05-01", "Staatsfeiertag"], ["2027-05-06", "Christi Himmelfahrt"], ["2027-05-17", "Pfingstmontag"],
  ["2027-05-27", "Fronleichnam"], ["2027-08-15", "Mariä Himmelfahrt"], ["2027-10-26", "Nationalfeiertag"],
  ["2027-11-01", "Allerheiligen"], ["2027-12-08", "Mariä Empfängnis"], ["2027-12-25", "Christtag"],
  ["2027-12-26", "Stefanitag"],
];

export function seedCalendar(now: ISODateTime): WorkCalendar {
  const day = [{ start: "08:00", end: "12:00" }, { start: "13:00", end: "17:00" }];
  return {
    timeZone: "Europe/Vienna",
    workingWeek: [1, 2, 3, 4, 5],
    workingHours: { 1: day, 2: day, 3: day, 4: day, 5: day },
    publicHolidays: HOLIDAYS.map(([date, name]): PublicHoliday => ({ date, name, source: ARG, verified: false })),
    // Removable company-specific closures (D12), never statutory public holidays (D8).
    companyClosures: [
      { date: "2026-12-24", name: "Demo company closure" },
      { date: "2026-12-31", name: "Demo company closure" },
    ],
    updatedAt: now,
  };
}

/** The lead demo scenario: a training session that starts this many minutes after seeding. */
export const RESCUE_LEAD_MINUTES = 45;
export const RESCUE_OPERATION_ID = "op-training-rescue";
export const RESCUE_OCCURRENCE_ID = occurrenceId(RESCUE_OPERATION_ID, ONE_OFF_PERIOD_KEY);
export const UPCOMING_OPERATION_ID = "op-training-upcoming";
export const UPCOMING_OCCURRENCE_ID = occurrenceId(UPCOMING_OPERATION_ID, ONE_OFF_PERIOD_KEY);
export const COMPLETED_OPERATION_ID = "op-training-complete";
export const COMPLETED_OCCURRENCE_ID = occurrenceId(COMPLETED_OPERATION_ID, ONE_OFF_PERIOD_KEY);
/** Operation IDs of the seeded training scenarios. A migrated modified demo replaces them (§11.2). */
export const SEED_TRAINING_OPERATION_IDS = [RESCUE_OPERATION_ID, UPCOMING_OPERATION_ID, COMPLETED_OPERATION_ID];

const MINUTE = 60_000;
const DAY_MINUTES = 24 * 60;

function trainingOperation(id: string, title: string, createdAt: ISODateTime): Operation {
  return {
    id,
    title,
    area: "LD",
    playbookId: TRAINING_PLAYBOOK_ID,
    playbookVersion: 2,
    ownerId: CURRENT_USER_ID,
    schedule: null,
    status: "active",
    createdAt,
  };
}

/** An occurrence generated in the past whose lead time has started by `now` is active, with an `activated` event. */
function activateIfStarted(occurrence: Occurrence, playbook: Playbook, now: ISODateTime): Occurrence {
  if (occurrence.status !== "scheduled" || openStatusAt(occurrence.anchorAt, playbook, occurrence.tasks, now) !== "active") return occurrence;
  const activatedAt = leadTimeStart(occurrence.anchorAt, playbook, occurrence.tasks);
  return {
    ...occurrence,
    status: "active",
    history: [...occurrence.history, historyEvent(occurrence, "activated", activatedAt, CURRENT_USER_ID)],
  };
}

/** Marks tasks done at the given times, each with a `task-completed` history event. */
function completeTasks(occurrence: Occurrence, completions: { taskId: string; at: ISODateTime; note: string }[]): Occurrence {
  let current = occurrence;
  for (const completion of completions) {
    const { taskId, note } = completion;
    // History stays in time order: nothing is completed before the previous event.
    const previous = current.history[current.history.length - 1].at;
    const at = new Date(Math.max(new Date(completion.at).getTime(), new Date(previous).getTime())).toISOString();
    const tasks = current.tasks.map((task): Task => (task.id === taskId ? { ...task, status: "done", resolvedAt: at, completionNote: note } : task));
    current = {
      ...current,
      tasks,
      history: [...current.history, historyEvent(current, "task-completed", at, CURRENT_USER_ID, { previousStatus: "not-started", responsible: "seed" }, taskId)],
    };
  }
  return current;
}

export function createSeedStore(nowInput: Date | ISODateTime): StoreV3 {
  const now = toInstant(nowInput);
  const nowMs = new Date(now).getTime();
  const playbooks = shippedPlaybooks();
  const training = playbooks.find((playbook) => playbook.id === TRAINING_PLAYBOOK_ID)!;
  const at = (offsetMinutes: number) => new Date(nowMs + offsetMinutes * MINUTE).toISOString();

  // 1. "Leading through change": starts 45 minutes after seeding, nothing prepared (the rescue scenario).
  const rescueAnchor = at(RESCUE_LEAD_MINUTES);
  const rescueOp = trainingOperation(RESCUE_OPERATION_ID, "Leading through change", at(-10 * DAY_MINUTES));
  const rescue = activateIfStarted(instantiateOccurrence({
    operation: rescueOp, playbook: training, periodKey: ONE_OFF_PERIOD_KEY,
    anchorAt: rescueAnchor, location: "Room 2.14 · HQ", now: rescueOp.createdAt, actorId: CURRENT_USER_ID,
  }), training, now);

  // 2. "Excel essentials for managers": in 4 days, trainer, participants and room confirmed.
  const upcomingAnchor = at(4 * DAY_MINUTES);
  const upcomingOp = trainingOperation(UPCOMING_OPERATION_ID, "Excel essentials for managers", at(-8 * DAY_MINUTES));
  const upcomingBase = activateIfStarted(instantiateOccurrence({
    operation: upcomingOp, playbook: training, periodKey: ONE_OFF_PERIOD_KEY,
    anchorAt: upcomingAnchor, location: "Training room · HQ", now: upcomingOp.createdAt, actorId: CURRENT_USER_ID,
  }), training, now);
  const doneOnTime = (taskId: string) => {
    const due = new Date(upcomingBase.tasks.find((task) => task.id === taskId)!.dueAt).getTime();
    return new Date(Math.min(due, nowMs) - 2 * 60 * MINUTE).toISOString();
  };
  const upcoming = completeTasks(
    upcomingBase,
    ["trainer-confirmed", "participants-confirmed", "room-confirmed"].map((taskId) => ({
      taskId, at: doneOnTime(taskId), note: "Confirmed in the demo workspace.",
    })),
  );

  // 3. "HR systems refresher": held 5 days ago, every task done on time, closed as completed.
  const completedAnchor = at(-5 * DAY_MINUTES);
  const completedOp = trainingOperation(COMPLETED_OPERATION_ID, "HR systems refresher", at(-14 * DAY_MINUTES));
  const completedBase = activateIfStarted(instantiateOccurrence({
    operation: completedOp, playbook: training, periodKey: ONE_OFF_PERIOD_KEY,
    anchorAt: completedAnchor, location: "Virtual · Teams", now: completedOp.createdAt, actorId: CURRENT_USER_ID,
  }), training, now);
  const completedTasks = completeTasks(
    completedBase,
    completedBase.tasks.map((task) => ({ taskId: task.id, at: addMinutes(task.dueAt, -30), note: "Completed in the demo workspace." })),
  );
  const closedAt = addMinutes(completedAnchor, 90);
  const completed: Occurrence = {
    ...completedTasks,
    status: "completed",
    closedAt,
    history: [...completedTasks.history, historyEvent(completedTasks, "closed", closedAt, CURRENT_USER_ID, { outcome: "completed", lateEssential: 0, skippedEssential: 0 })],
  };

  return {
    version: 3,
    savedAt: now,
    modified: false,
    calendar: seedCalendar(now),
    people: structuredClone(PEOPLE),
    counterparties: structuredClone(COUNTERPARTIES),
    playbooks,
    operations: [rescueOp, upcomingOp, completedOp],
    occurrences: [rescue, upcoming, completed],
  };
}
