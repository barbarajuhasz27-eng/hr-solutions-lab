/** lib/messages/en.ts: stable keys for data-driven strings (§8.6). */
import { describe, expect, it } from "vitest";
import { DOMAIN_ERROR_CODES } from "../lib/domain/errors";
import { applyAction, type HubAction } from "../lib/domain/reducer";
import { createSeedStore, CURRENT_USER_ID, RESCUE_OCCURRENCE_ID, RESCUE_OPERATION_ID } from "../lib/domain/seed";
import { HISTORY_EVENT_KINDS, type HistoryEvent } from "../lib/domain/types";
import { formatDateTime } from "../lib/format";
import { describeHistoryEvent, EN, historyMessageKey, isMessageKey, message, type HistoryContext } from "../lib/messages/en";

/** The engine's reason codes (§7), including the renamed `anchor-passed` and the four new ones. */
const REASON_CODES = [
  "anchor-passed", "blocked", "deadline-passed", "waiting-near-deadline", "insufficient-time", "dependency-risk",
  "waiting", "due-soon", "owner-unavailable", "calendar-drift", "calendar-missing-holidays", "independence-conflict",
];

const context: HistoryContext = {
  taskTitle: (id) => `Task ${id}`,
  assigneeName: (ref) => ({ "person:p-sophie": "Sophie Lang", "person:p-daniel": "Daniel Hofer", "counterparty:cp-it": "IT Service Desk" })[ref] ?? ref,
  playbookTitle: (id) => (id === "training-session" ? "Training session" : id),
  formatInstant: formatDateTime,
};

const event = (kind: HistoryEvent["kind"], detail: HistoryEvent["detail"] = {}, taskId?: string): HistoryEvent => ({
  id: "x#1", at: "2026-11-03T08:00:00.000Z", actorId: CURRENT_USER_ID, kind, detail, ...(taskId ? { taskId } : {}),
});

describe("catalogue keys", () => {
  it("has a readiness reason for every engine reason code", () => {
    for (const code of REASON_CODES) expect(isMessageKey(`reason.${code}`)).toBe(true);
  });

  it("resolves a key for every history event kind", () => {
    for (const kind of HISTORY_EVENT_KINDS) {
      expect(isMessageKey(historyMessageKey(event(kind)))).toBe(true);
    }
    expect(historyMessageKey(event("hold-set", { holdKind: "blocked" }))).toBe("history.hold-set.blocked");
    expect(historyMessageKey(event("hold-set", { holdKind: "waiting" }))).toBe("history.hold-set.waiting");
    expect(historyMessageKey(event("skipped", {}, "it-setup"))).toBe("history.task-skipped");
    expect(historyMessageKey(event("skipped"))).toBe("history.skipped");
  });

  it("has an error message for every domain error code the reducer raises", () => {
    // The list is the source of truth for the DomainErrorCode union, so new codes cannot miss a message.
    expect(DOMAIN_ERROR_CODES).toEqual(expect.arrayContaining(["invalid-schedule", "invalid-calendar", "non-working-day", "no-drift", "not-recurring"]));
    for (const code of DOMAIN_ERROR_CODES) expect(isMessageKey(`error.${code}`)).toBe(true);
  });

  it("has a message for every generation issue and the calendar warnings of §6.1", () => {
    for (const issue of ["nth-working-day-out-of-range", "working-days-before-month-end-out-of-range", "rule-frequency-mismatch", "no-working-day", "playbook-not-found", "backup-required"]) {
      expect(isMessageKey(`generation.${issue}`)).toBe(true);
    }
    expect(message("calendar.unverified-holidays", { years: "2026–2027" })).toBe(
      "Public holidays for 2026–2027 were entered manually and have not been checked against the official source. Deadlines that depend on them may be wrong.",
    );
    expect(message("calendar.missing-holidays", { year: 2028 })).toBe("No public holidays configured for 2028; working-day deadlines may be wrong");
  });

  it("does not resolve unknown keys", () => {
    expect(isMessageKey("history.unknown")).toBe(false);
    expect(isMessageKey("toString")).toBe(false);
  });
});

describe("message()", () => {
  it("fills placeholders", () => {
    expect(message("reason.due-soon", { task: "Confirm room", duration: "45 min" })).toBe("Confirm room: due in 45 min.");
    expect(message("notice.reset", { minutes: 45 })).toBe("Demo data restored. The training scenario starts in 45 minutes.");
  });

  it("renders the exact notices", () => {
    expect(message("notice.migrated")).toBe("Your earlier demo changes were kept and moved into the new workspace.");
    expect(message("closeout.essential-skipped")).toBe("Essential task skipped · can only close as missed");
    expect(message("closeout.late-follow-up")).toBe("Completed late · late follow-up");
  });

  it("leaves a placeholder visible when a parameter is missing at runtime", () => {
    const unsafe = message as unknown as (key: string, params?: Record<string, string>) => string;
    expect(unsafe("reason.due-soon", { task: "X" })).toBe("X: due in {duration}.");
  });

  it("every template only uses {name} placeholders", () => {
    for (const template of Object.values(EN)) {
      expect(template.replace(/\{\w+\}/g, "")).not.toMatch(/[{}]/);
    }
  });
});

describe("describeHistoryEvent()", () => {
  it.each<[HistoryEvent, string]>([
    [event("generated", { playbookId: "training-session", playbookVersion: 2 }), "Occurrence created from Training session v2."],
    [event("activated"), "Occurrence became active."],
    [event("task-completed", {}, "room"), "“Task room” marked done."],
    [event("task-reopened", {}, "room"), "“Task room” reopened."],
    [event("hold-set", { holdKind: "waiting", waitingOn: "Facilities" }, "room"), "“Task room” put on hold: waiting on Facilities."],
    [event("hold-set", { holdKind: "blocked" }, "room"), "“Task room” marked blocked."],
    [event("hold-released", { holdKind: "waiting", heldMinutes: 5 }, "room"), "Hold on “Task room” released."],
    [event("fallback-used", {}, "room"), "Fallback used for “Task room”."],
    [event("task-reassigned", { from: "counterparty:cp-it", to: "person:p-daniel" }, "it"), "“Task it” reassigned from IT Service Desk to Daniel Hofer."],
    [event("skipped", {}, "room"), "“Task room” skipped."],
    [event("coverage-added", { absentPersonId: "p-sophie", coveringPersonId: "p-daniel" }), "Daniel Hofer covers for Sophie Lang."],
    [event("coverage-removed", { absentPersonId: "p-sophie" }), "Cover for Sophie Lang removed."],
    [event("moved", { from: "2026-11-23T11:00:00.000Z", to: "2026-11-24T11:00:00.000Z" }), "Anchor moved from 23.11.2026 12:00 to 24.11.2026 12:00."],
    [event("skipped"), "Occurrence skipped."],
    [event("closed", { outcome: "completed-late" }), "Occurrence closed as Completed late."],
    [event("recovery-decision"), "Recovery decision recorded."],
    [event("calendar-drift-applied", { to: "2026-12-21T11:00:00.000Z" }), "Calendar change applied: anchor moved to 21.12.2026 12:00."],
    [event("migrated", { fromVersion: 2 }), "Moved into the new workspace from the earlier demo (v2)."],
    [event("moved", { from: "2026-11-23T11:00:00.000Z", to: "2026-11-25T11:00:00.000Z", reason: "schedule-changed" }), "Schedule change applied: anchor moved from 23.11.2026 12:00 to 25.11.2026 12:00."],
    [event("drift-kept", { source: "calendar", suggested: "2026-12-23T11:00:00.000Z" }), "Calendar change reviewed: kept the current date; the rule would give 23.12.2026 12:00."],
    [event("drift-kept", { source: "schedule", suggested: "2026-11-25T11:00:00.000Z" }), "Schedule change reviewed: kept the current date; the rule would give 25.11.2026 12:00."],
  ])("%#: %s", (input, expected) => {
    expect(describeHistoryEvent(input, context)).toBe(expected);
  });

  it("describes every event the reducer writes, without unresolved placeholders", () => {
    let store = createSeedStore("2026-11-03T08:00:00.000Z");
    const ctx = { now: "2026-11-03T08:10:00.000Z", actorId: CURRENT_USER_ID };
    const t = { occurrenceId: RESCUE_OCCURRENCE_ID, taskId: "room-confirmed" };
    const actions: HubAction[] = [
      { type: "setHold", ...t, hold: { kind: "waiting", waitingOn: "Facilities" } },
      { type: "releaseHold", ...t },
      { type: "reassignTask", ...t, responsible: { kind: "person", personId: "p-lena" } },
      { type: "useFallback", ...t },
      { type: "reopenTask", ...t },
      { type: "skipTask", ...t, reason: "Virtual" },
      { type: "moveOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, anchorAt: "2026-11-03T10:00:00.000Z" },
      { type: "closeOccurrence", occurrenceId: RESCUE_OCCURRENCE_ID, outcome: "missed", note: "Postponed" },
      { type: "updateOwnership", operationId: RESCUE_OPERATION_ID, ownerId: "p-daniel" },
    ];
    for (const action of actions) store = applyAction(store, action, ctx);
    const rescue = store.occurrences.find((item) => item.id === RESCUE_OCCURRENCE_ID)!;
    const lookup: HistoryContext = {
      taskTitle: (id) => rescue.tasks.find((task) => task.id === id)!.title,
      assigneeName: (ref) => ref,
      playbookTitle: (id) => store.playbooks.find((playbook) => playbook.id === id)!.title,
      formatInstant: formatDateTime,
    };
    for (const item of [...store.occurrences.flatMap((occurrence) => occurrence.history)]) {
      expect(describeHistoryEvent(item, lookup)).not.toMatch(/[{}]/);
    }
  });
});
