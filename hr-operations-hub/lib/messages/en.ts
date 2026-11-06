/**
 * Message catalogue for strings built from data (§8.6): readiness reasons, history events, close-out
 * notices, migration and stale-demo notices, notes written by the app and domain errors.
 *
 * Keys are stable codes. Templates use `{name}` placeholders, and the parameter names are checked by the
 * type system. Static UI labels stay in components until real localisation.
 */
import type { HistoryEvent, HistoryEventKind } from "../domain/types";

export const EN = {
  // Readiness reasons (§7). The codes are the engine's reason codes; M3 renders reasons through them.
  "reason.anchor-passed": "The anchor passed {duration} ago with {count} essential task(s) still open.",
  "reason.blocked": "{task}: blocked{note}.",
  "reason.deadline-passed": "{task}: due time passed {duration} ago.",
  "reason.waiting-near-deadline": "{task}: still waiting on {party}, and due in {duration}.",
  "reason.insufficient-time": "About {required} min of work remains, but only {available} remain.",
  "reason.dependency-risk": "{task}: cannot start until “{prerequisite}” is resolved, and that step is at risk.",
  "reason.waiting": "{task}: waiting on {party}.",
  "reason.due-soon": "{task}: due in {duration}.",
  "reason.owner-unavailable": "{task}: {person} is unavailable on the due date.",
  "reason.calendar-drift": "Calendar changed: the rule now gives {date}.",
  "reason.calendar-missing-holidays": "No public holidays configured for {year}; working-day deadlines may be wrong.",
  "reason.independence-conflict": "{task}: the reviewer is also responsible for “{preparer}”. A four-eyes control needs someone else.",

  // History events (§4.2). One entry per HistoryEvent kind.
  "history.generated": "Occurrence created from {playbook} v{version}.",
  "history.activated": "Occurrence became active.",
  "history.task-completed": "“{task}” marked done.",
  "history.task-reopened": "“{task}” reopened.",
  "history.hold-set.waiting": "“{task}” put on hold: waiting on {party}.",
  "history.hold-set.blocked": "“{task}” marked blocked.",
  "history.hold-released": "Hold on “{task}” released.",
  "history.fallback-used": "Fallback used for “{task}”.",
  "history.task-reassigned": "“{task}” reassigned from {from} to {to}.",
  "history.task-skipped": "“{task}” skipped.",
  "history.coverage-added": "{covering} covers for {absent}.",
  "history.coverage-removed": "Cover for {absent} removed.",
  "history.moved": "Anchor moved from {from} to {to}.",
  "history.skipped": "Occurrence skipped.",
  "history.closed": "Occurrence closed as {outcome}.",
  "history.recovery-decision": "Recovery decision recorded.",
  "history.calendar-drift-applied": "Calendar change applied: anchor moved to {to}.",
  "history.migrated": "Moved into the new workspace from the earlier demo (v{fromVersion}).",
  "history.drift-kept": "{source} change reviewed: kept the current date; the rule would give {suggested}.",
  "history.moved.schedule": "Schedule change applied: anchor moved from {from} to {to}.",
  "history.drift-suggested": "{source} changed: the rule now gives {suggested} instead of {anchor}. Apply or keep the current date.",
  "history.drift-suggestion-cleared": "{source} suggestion for {suggested} withdrawn: {reason}.",

  // Schedule and calendar (§6.1, §6.6, §6.7). Rendered by the M6/M7 screens.
  "schedule.drift": "Schedule changed: new rule gives {date}",
  "calendar.drift": "Calendar changed: rule now gives {date}",
  "calendar.unverified-holidays": "Public holidays for {years} were entered manually and have not been checked against the official source. Deadlines that depend on them may be wrong.",
  "calendar.missing-holidays": "No public holidays configured for {year}; working-day deadlines may be wrong",
  "calendar.unverified-marker": "unverified calendar",
  "calendar.day-without-hours": "{weekday} is a working day without working hours: it adds no working time.",
  "calendar.public-holiday": "Public holiday",
  "calendar.company-closure": "Company closure",
  "calendar.projected": "Projected",
  "drift.source.calendar": "Calendar",
  "drift.source.schedule": "Schedule",
  "drift.cleared.superseded": "a newer change gives another date",
  "drift.cleared.no-longer-different": "the rule gives the current date again",
  "drift.cleared.no-valid-candidate": "the rule can no longer place this period",
  "drift.cleared.kept-earlier": "this date was already reviewed and kept",
  "generation.nth-working-day-out-of-range": "The rule asks for working day {n}, but this month has fewer working days. The occurrence was not generated.",
  "generation.working-days-before-month-end-out-of-range": "This month has too few working days for the rule. The occurrence was not generated.",
  "generation.rule-frequency-mismatch": "This rule cannot be used with this frequency.",
  "generation.no-working-day": "The work calendar has no working day for this period.",
  "generation.playbook-not-found": "The operation's playbook version is missing.",
  "generation.backup-required": "The playbook assigns essential tasks to the backup, but the operation has none.",

  // Close-out (§6.5).
  "outcome.completed": "Completed",
  "outcome.completed-late": "Completed late",
  "outcome.missed": "Missed",
  "outcome.cancelled": "Cancelled",
  "outcome.skipped": "Skipped",
  "closeout.essential-skipped": "Essential task skipped · can only close as missed",
  "closeout.essential-open": "Essential tasks still open · can only close as missed",
  "closeout.late-follow-up": "Completed late · late follow-up",

  // Notes written by the app (privacy-safe, §4.5).
  "note.completed-workspace": "Completed in the demo workspace.",
  "note.completed-recovery": "Completed in Rapid Recovery.",
  "note.fallback-used": "Fallback used: {fallback}",

  // Notices.
  "notice.migrated": "Your earlier demo changes were kept and moved into the new workspace.",
  "notice.timeline-shifted": "The demo timeline was moved forward by {duration}, so countdowns look as you left them.",
  "notice.timeline-realigned": "The demo timeline was realigned to today.",
  "notice.recurring-kept": "Recurring operations keep their calendar dates.",
  "notice.welcome-back": "Welcome back. Your demo changes were kept.",
  "notice.reset-hint": "Use “Reset demo” to start the scenario fresh.",
  "notice.restored": "Saved demo data could not be read, so the demo was restored.",
  "notice.reset": "Demo data restored. The training scenario starts in {minutes} minutes.",
  "notice.created": "New activity created from the playbook, scheduled two weeks from now.",
  "notice.not-saved": "This browser did not accept the demo data, so changes are kept only until you leave the page.",

  // Domain errors raised by the reducer.
  "error.occurrence-not-found": "This occurrence does not exist in the demo.",
  "error.operation-not-found": "This operation does not exist in the demo.",
  "error.task-not-found": "This task does not exist in the occurrence.",
  "error.playbook-not-found": "This playbook is not available.",
  "error.playbook-not-available": "This playbook is still in design.",
  "error.occurrence-closed": "This occurrence is closed and read-only.",
  "error.task-resolved": "This task is already resolved.",
  "error.task-not-resolved": "Only a done or skipped task can be reopened.",
  "error.task-not-on-hold": "This task is not on hold.",
  "error.invalid-hold": "The hold is incomplete or too long.",
  "error.no-fallback": "This task has no fallback.",
  "error.essential-unassigned": "An essential task can never be unassigned.",
  "error.unknown-assignee": "The person or counterparty does not exist.",
  "error.same-assignee": "The task is already assigned to them.",
  "error.owner-not-person": "The owner must be a person.",
  "error.backup-equals-owner": "The backup must be a different person from the owner.",
  "error.backup-required": "This playbook assigns essential tasks to the backup, so a backup is required.",
  "error.duplicate-id": "An operation with this ID already exists.",
  "error.outcome-not-allowed": "This close-out outcome is not allowed for the current task state.",
  "error.note-required": "A note is required.",
  "error.note-too-long": "Keep the note to {max} characters or fewer.",
  "error.invalid-instant": "The date and time are not valid.",
  "error.offset-unit-unsupported": "This offset unit is not supported.",
  "error.cancel-one-off-only": "Only one-off operations can be cancelled.",
  "error.invalid-status": "This status change is not allowed.",
  "error.invalid-schedule": "The schedule is not valid.",
  "error.invalid-calendar": "The work calendar is not valid.",
  "error.invalid-date": "The date is not valid.",
  "error.not-recurring": "Only a recurring operation has a schedule.",
  "error.non-working-day": "The new date is not a working day. Confirm the move to use it anyway.",
  "error.drift-decision-required": "A schedule or calendar change suggests another date for this occurrence. Apply or keep it first.",
  "error.no-drift": "There is no schedule or calendar change to review for this occurrence.",
  "error.no-working-day": "The work calendar has no working day near this date.",
} as const;

export type MessageKey = keyof typeof EN;

type Placeholders<S extends string> = S extends `${string}{${infer Name}}${infer Rest}` ? Name | Placeholders<Rest> : never;
export type MessageParams<K extends MessageKey> = Record<Placeholders<(typeof EN)[K]>, string | number>;

type ParamArgs<K extends MessageKey> = [Placeholders<(typeof EN)[K]>] extends [never] ? [] : [params: MessageParams<K>];

/** Renders a catalogue entry. Unknown placeholders are left visible, so a missing parameter is noticed. */
export function message<K extends MessageKey>(key: K, ...args: ParamArgs<K>): string {
  const template: string = EN[key];
  const params = (args[0] ?? {}) as Record<string, string | number>;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

export function isMessageKey(key: string): key is MessageKey {
  return Object.prototype.hasOwnProperty.call(EN, key);
}

/** Lookups a history description needs: names and titles are resolved from the store, never stored in `detail`. */
export interface HistoryContext {
  taskTitle: (taskId: string) => string;
  assigneeName: (ref: string) => string;
  playbookTitle: (playbookId: string) => string;
  formatInstant: (iso: string) => string;
}

const str = (value: string | number | boolean | undefined) => (value === undefined ? "" : String(value));
const driftSource = (source: string | number | boolean | undefined) => EN[source === "schedule" ? "drift.source.schedule" : "drift.source.calendar"];

/** The catalogue key a history event is rendered with. */
export function historyMessageKey(event: Pick<HistoryEvent, "kind" | "taskId" | "detail">): MessageKey {
  if (event.kind === "hold-set") return event.detail.holdKind === "blocked" ? "history.hold-set.blocked" : "history.hold-set.waiting";
  if (event.kind === "skipped" && event.taskId) return "history.task-skipped";
  if (event.kind === "moved" && event.detail.reason === "schedule-changed") return "history.moved.schedule";
  return `history.${event.kind}` satisfies `history.${HistoryEventKind}`;
}

export function describeHistoryEvent(event: HistoryEvent, context: HistoryContext): string {
  const task = event.taskId ? context.taskTitle(event.taskId) : "";
  const d = event.detail;
  const key = historyMessageKey(event);
  switch (key) {
    case "history.generated":
      return message(key, { playbook: context.playbookTitle(str(d.playbookId)), version: str(d.playbookVersion) });
    case "history.task-completed":
    case "history.task-reopened":
    case "history.hold-set.blocked":
    case "history.hold-released":
    case "history.fallback-used":
    case "history.task-skipped":
      return message(key, { task });
    case "history.hold-set.waiting":
      return message(key, { task, party: str(d.waitingOn) || "another person or team" });
    case "history.task-reassigned":
      return message(key, { task, from: context.assigneeName(str(d.from)), to: context.assigneeName(str(d.to)) });
    case "history.coverage-added":
      return message(key, { covering: context.assigneeName(`person:${str(d.coveringPersonId)}`), absent: context.assigneeName(`person:${str(d.absentPersonId)}`) });
    case "history.coverage-removed":
      return message(key, { absent: context.assigneeName(`person:${str(d.absentPersonId)}`) });
    case "history.moved":
    case "history.moved.schedule":
      return message(key, { from: context.formatInstant(str(d.from)), to: context.formatInstant(str(d.to)) });
    case "history.drift-kept":
      return message(key, {
        source: driftSource(d.source),
        suggested: context.formatInstant(str(d.suggested)),
      });
    case "history.calendar-drift-applied":
      return message(key, { to: context.formatInstant(str(d.to)) });
    case "history.drift-suggested":
      return message(key, { source: driftSource(d.source), suggested: context.formatInstant(str(d.suggested)), anchor: context.formatInstant(str(d.anchorAt)) });
    case "history.drift-suggestion-cleared": {
      const reason = `drift.cleared.${str(d.reason)}`;
      return message(key, { source: driftSource(d.source), suggested: context.formatInstant(str(d.suggested)), reason: isMessageKey(reason) ? EN[reason] : str(d.reason) });
    }
    case "history.closed":
      return message(key, { outcome: isMessageKey(`outcome.${str(d.outcome)}`) ? EN[`outcome.${str(d.outcome)}` as MessageKey] : str(d.outcome) });
    case "history.migrated":
      return message(key, { fromVersion: str(d.fromVersion) });
    case "history.activated":
    case "history.skipped":
    case "history.recovery-decision":
      return message(key);
    default:
      return EN[key];
  }
}
