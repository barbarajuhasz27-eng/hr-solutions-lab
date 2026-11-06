/**
 * Migration from the v1/v2 demo storage to the v3 store (§11.2–11.5).
 *
 * The fixtures in tests/fixtures were written by the original M0 code from `main` (seed, engine updates
 * and "Create activity"), so these tests run against the exact format earlier versions stored:
 * - v2-modified.json: a v2 store with a done task, a fallback, a Waiting and a Blocked hold with notes,
 *   a completed activity and a visitor-created activity. Saved 2026-11-03T08:20Z.
 * - v2-untouched.json: a v2 store without visitor changes.
 * - v1-modified.json: the legacy v1 bare activity array.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createSeedStore, RESCUE_OCCURRENCE_ID, SEED_TRAINING_OPERATION_IDS } from "../lib/domain/seed";
import type { Occurrence, StoreV3, Task } from "../lib/domain/types";
import { findInvariantViolations, parseStoreV3 } from "../lib/domain/validate";
import { EN } from "../lib/messages/en";
import type { Activity } from "../lib/model";
import { operationIdForActivity } from "../lib/store/migrate";
import { loadStore, resolveStore, saveStore, STORE_KEY, type StorageLike } from "../lib/store/persistence";
import { STALE_AFTER_MINUTES, V1_STORAGE_KEY, V2_STORAGE_KEY } from "../lib/storage";

const fixture = (name: string) => readFileSync(resolve(__dirname, "fixtures", name), "utf8");
const V2_MODIFIED = fixture("v2-modified.json");
const V2_UNTOUCHED = fixture("v2-untouched.json");
const V1_MODIFIED = fixture("v1-modified.json");
const v2Activities = (JSON.parse(V2_MODIFIED) as { activities: Activity[] }).activities;

const MINUTE = 60_000;
const SAVED_AT = "2026-11-03T08:20:00.000Z";
/** Within the 30-minute window: the v2 timeline is used unshifted. */
const SOON = "2026-11-03T08:30:00.000Z";

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  constructor(initial: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initial)) this.data.set(key, value);
  }
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

/** Throws on every write, e.g. a full or blocked storage. */
class FailingWriteStorage extends MemoryStorage {
  setItem(): void {
    throw new Error("QuotaExceededError");
  }
}

/** Accepts the write but returns damaged data when read back. */
class CorruptingStorage extends MemoryStorage {
  setItem(key: string, value: string) {
    super.setItem(key, value.slice(0, value.length / 2));
  }
}

const occurrenceOf = (store: StoreV3, activityId: string) =>
  store.occurrences.find((occurrence) => occurrence.operationId === operationIdForActivity(activityId))!;
const taskOf = (occurrence: Occurrence, id: string) => occurrence.tasks.find((task) => task.id === id)!;

describe("v2 → v3, modified demo (§11.2 step 4, §11.3)", () => {
  const { store, source, notice } = resolveStore({ v3: null, v2: V2_MODIFIED, v1: null }, SOON);
  const rescue = occurrenceOf(store, "activity-training-rescue");

  it("produces a valid v3 store and shows the migration notice", () => {
    expect(source).toBe("migrated");
    expect(parseStoreV3(store)).not.toBeNull();
    expect(findInvariantViolations(store)).toEqual([]);
    expect(store.version).toBe(3);
    expect(store.modified).toBe(true);
    expect(notice).toContain("Your earlier demo changes were kept and moved into the new workspace.");
  });

  it("converts each activity to one one-off operation plus one occurrence, without the seed's duplicate training occurrences", () => {
    expect(store.operations).toHaveLength(v2Activities.length);
    expect(store.occurrences).toHaveLength(v2Activities.length);
    expect(store.operations.map((operation) => operation.id)).toEqual(v2Activities.map((activity) => operationIdForActivity(activity.id)));
    // The seed's own training operations share IDs with the migrated ones and appear exactly once.
    expect(new Set(store.occurrences.map((occurrence) => occurrence.id)).size).toBe(store.occurrences.length);
    for (const operation of store.operations) {
      expect(operation).toMatchObject({ schedule: null, area: "LD", playbookId: "training-session", playbookVersion: 2, ownerId: "p-sophie", status: "active" });
    }
    for (const occurrence of store.occurrences) {
      expect(occurrence).toMatchObject({ periodKey: "once", anchorKind: "event-start", playbookId: "training-session", playbookVersion: 2, ownerId: "p-sophie" });
      expect(occurrence.id).toBe(`${occurrence.operationId}:once`);
    }
    // The rescue scenario keeps its canonical v3 ID.
    expect(rescue.id).toBe(RESCUE_OCCURRENCE_ID);
  });

  it("keeps the original dates, location and relative task due offsets", () => {
    for (const activity of v2Activities) {
      const occurrence = occurrenceOf(store, activity.id);
      expect(occurrence.anchorAt).toBe(activity.startsAt);
      expect(occurrence.eventDetails).toEqual({ location: activity.location });
      expect(occurrence.tasks.map((task) => task.id)).toEqual(activity.actions.map((action) => action.id));
      for (const action of activity.actions) {
        const task = taskOf(occurrence, action.id);
        expect((new Date(task.dueAt).getTime() - new Date(activity.startsAt).getTime()) / MINUTE).toBe(action.dueOffsetMinutes);
        expect(task).toMatchObject({ title: action.title, criticality: action.criticality, estimatedMinutes: action.estimatedMinutes, dependsOn: action.dependsOn, fallback: action.fallback });
      }
    }
  });

  it("maps HR roles to the owner and Facilities / IT to their counterparties", () => {
    expect(taskOf(rescue, "trainer-confirmed").responsible).toEqual({ kind: "person", personId: "p-sophie" }); // HR / Trainer
    expect(taskOf(rescue, "participants-confirmed").responsible).toEqual({ kind: "person", personId: "p-sophie" }); // HR
    expect(taskOf(rescue, "room-confirmed").responsible).toEqual({ kind: "counterparty", counterpartyId: "cp-facilities" });
    expect(taskOf(rescue, "it-setup").responsible).toEqual({ kind: "counterparty", counterpartyId: "cp-it" });
  });

  it("preserves action status, completion notes and fallback usage, with resolvedAt for resolved tasks", () => {
    const trainer = taskOf(rescue, "trainer-confirmed");
    expect(trainer).toMatchObject({ status: "done", completionNote: "Completed in the demo workspace.", resolvedAt: SAVED_AT });
    expect(trainer.fallbackUsed).toBeUndefined();

    const participants = taskOf(rescue, "participants-confirmed");
    expect(participants).toMatchObject({ status: "done", fallbackUsed: true, resolvedAt: SAVED_AT });
    expect(participants.completionNote).toBe("Fallback used: Use the existing registration list and brief the trainer on any gaps.");

    for (const id of ["participant-reminder", "materials-ready", "attendance-followup"]) {
      const task = taskOf(rescue, id);
      expect(task.status).toBe("not-started");
      expect(task.resolvedAt).toBeUndefined();
      expect(task.hold).toBeUndefined();
    }
  });

  it("turns Waiting and Blocked into holds with their waiting-on details and notes", () => {
    const room = taskOf(rescue, "room-confirmed");
    expect(room.status).toBe("waiting");
    expect(room.hold).toEqual({ kind: "waiting", waitingOn: "Facilities", note: "Asked for Room 2.14 at 09:10", since: SAVED_AT });
    expect(room.completionNote).toBeUndefined();

    const it = taskOf(rescue, "it-setup");
    expect(it.status).toBe("blocked");
    expect(it.hold).toEqual({ kind: "blocked", note: "Projector cable missing", since: SAVED_AT });
  });

  it("converts a completed activity into a closed, completed occurrence", () => {
    const source = v2Activities.find((activity) => activity.completedAt)!;
    const closed = occurrenceOf(store, source.id);
    expect(closed.status).toBe("completed");
    expect(closed.closedAt).toBe(source.completedAt);
    expect(closed.tasks.every((task: Task) => task.status === "done" && task.resolvedAt === source.completedAt)).toBe(true);
  });

  it("derives open statuses from the lead time: active once it has started, scheduled before", () => {
    expect(rescue.status).toBe("active"); // starts 25 minutes after SOON
    expect(occurrenceOf(store, "activity-training-upcoming").status).toBe("active"); // in 4 days, lead time 7 days
    expect(occurrenceOf(store, "activity-4-1793692800000").status).toBe("scheduled"); // in 14 days
  });

  it("records exactly one migrated history event per occurrence", () => {
    for (const occurrence of store.occurrences) {
      expect(occurrence.history).toEqual([
        {
          id: `${occurrence.id}#1`,
          at: SOON,
          actorId: "p-sophie",
          kind: "migrated",
          detail: expect.objectContaining({ fromVersion: 2 }),
        },
      ]);
    }
    expect(rescue.history[0].detail).toMatchObject({ sourceActivityId: "activity-training-rescue", resolvedAtApproximate: true });
  });

  it("keeps the work calendar, people, counterparties and shipped playbooks from the fresh v3 seed", () => {
    const seed = createSeedStore(SOON);
    expect(store.calendar).toEqual(seed.calendar);
    expect(store.people).toEqual(seed.people);
    expect(store.counterparties).toEqual(seed.counterparties);
    expect(store.playbooks).toEqual(seed.playbooks);
  });
});

describe("v2 → v3, stale demos (§11.4)", () => {
  it("moves a stale modified v2 demo forward by the time away, preserving the relative timeline", () => {
    const now = new Date(new Date(SAVED_AT).getTime() + 3 * 24 * 60 * MINUTE).toISOString();
    const { store, notice } = resolveStore({ v3: null, v2: V2_MODIFIED, v1: null }, now);
    const rescue = occurrenceOf(store, "activity-training-rescue");
    expect((new Date(rescue.anchorAt).getTime() - new Date(now).getTime()) / MINUTE).toBe(25);
    expect(taskOf(rescue, "room-confirmed").hold).toMatchObject({ kind: "waiting", waitingOn: "Facilities", since: now });
    expect(taskOf(rescue, "trainer-confirmed").resolvedAt).toBe(now);
    expect(notice).toContain(EN["notice.migrated"]);
    expect(notice).toContain("moved forward by 3 d");
  });

  it("builds a fresh v3 seed for an untouched v2 demo; nothing is lost", () => {
    const { store, source, notice } = resolveStore({ v3: null, v2: V2_UNTOUCHED, v1: null }, SOON);
    expect(source).toBe("fresh");
    expect(notice).toBeUndefined();
    expect(store.modified).toBe(false);
    expect(store.operations.map((operation) => operation.id)).toEqual(SEED_TRAINING_OPERATION_IDS);
    expect(store.occurrences.flatMap((occurrence) => occurrence.history).some((event) => event.kind === "migrated")).toBe(false);
  });

  it("builds a fresh seed for a stale untouched v2 demo", () => {
    const now = new Date(new Date(SAVED_AT).getTime() + (STALE_AFTER_MINUTES + 5) * MINUTE).toISOString();
    expect(resolveStore({ v3: null, v2: V2_UNTOUCHED, v1: null }, now).source).toBe("fresh");
  });
});

describe("v1 → v3", () => {
  it("migrates the legacy bare array, realigned so the rescue scenario starts 45 minutes from now", () => {
    const now = "2026-11-10T12:00:00.000Z";
    const { store, source, notice } = resolveStore({ v3: null, v2: null, v1: V1_MODIFIED }, now);
    expect(source).toBe("migrated");
    expect(parseStoreV3(store)).not.toBeNull();
    const rescue = occurrenceOf(store, "activity-training-rescue");
    expect((new Date(rescue.anchorAt).getTime() - new Date(now).getTime()) / MINUTE).toBe(45);
    expect(taskOf(rescue, "trainer-confirmed").status).toBe("done");
    expect(taskOf(rescue, "room-confirmed").hold).toMatchObject({ kind: "waiting", waitingOn: "Facilities", note: "Asked for Room 2.14 at 09:10" });
    expect(taskOf(rescue, "it-setup").hold).toMatchObject({ kind: "blocked", note: "Projector cable missing" });
    expect(taskOf(rescue, "participants-confirmed").fallbackUsed).toBe(true);
    expect(rescue.history[0].detail.fromVersion).toBe(1);
    expect(notice).toContain(EN["notice.migrated"]);
    expect(notice).toContain(EN["notice.timeline-realigned"]);
  });

  it("prefers valid v2 data over a v1 leftover", () => {
    const { store } = resolveStore({ v3: null, v2: V2_MODIFIED, v1: V1_MODIFIED }, SOON);
    expect(store.occurrences[0].history[0].detail.fromVersion).toBe(2);
    expect(store.occurrences).toHaveLength(v2Activities.length);
  });
});

describe("corrupt and unreadable storage", () => {
  it.each([
    ["not JSON", "{not json"],
    ["wrong version", JSON.stringify({ version: 7, activities: [] })],
    ["invalid savedAt", JSON.stringify({ version: 2, savedAt: "x", modified: true, activities: [] })],
    ["activities missing fields", JSON.stringify({ version: 2, savedAt: SAVED_AT, modified: true, activities: [{ id: "a" }] })],
  ])("restores a fresh seed for corrupt v2 data (%s)", (_label, raw) => {
    const { store, source, notice } = resolveStore({ v3: null, v2: raw, v1: null }, SOON);
    expect(source).toBe("restored");
    expect(notice).toBe(EN["notice.restored"]);
    expect(store.modified).toBe(false);
    expect(store.operations.map((operation) => operation.id)).toEqual(SEED_TRAINING_OPERATION_IDS);
  });

  it("falls back to v2 migration when the v3 data is corrupt", () => {
    const { source, store } = resolveStore({ v3: "{\"version\":3}", v2: V2_MODIFIED, v1: null }, SOON);
    expect(source).toBe("migrated");
    expect(store.occurrences).toHaveLength(v2Activities.length);
  });

  it("rejects a v3 store that has the right shape but breaks a model invariant", () => {
    const broken = createSeedStore(SOON);
    broken.occurrences[0].tasks[0].criticality = "essential";
    broken.occurrences[0].tasks[0].responsible = { kind: "unassigned" };
    expect(resolveStore({ v3: JSON.stringify(broken), v2: null, v1: null }, SOON).source).toBe("restored");
  });

  it("seeds a fresh demo without a notice when nothing is stored", () => {
    const { source, notice } = resolveStore({ v3: null, v2: null, v1: null }, SOON);
    expect(source).toBe("fresh");
    expect(notice).toBeUndefined();
  });
});

describe("writing v3 before removing v1/v2 (§11.2 step 5)", () => {
  it("writes and validates v3, then removes the v2 and v1 keys", () => {
    const storage = new MemoryStorage({ [V2_STORAGE_KEY]: V2_MODIFIED, [V1_STORAGE_KEY]: V1_MODIFIED });
    const result = loadStore(storage, SOON);
    expect(result.persisted).toBe(true);
    expect(parseStoreV3(JSON.parse(storage.getItem(STORE_KEY)!))).not.toBeNull();
    expect(storage.getItem(V2_STORAGE_KEY)).toBeNull();
    expect(storage.getItem(V1_STORAGE_KEY)).toBeNull();
  });

  it("keeps the v2 data when writing v3 fails", () => {
    const storage = new FailingWriteStorage({ [V2_STORAGE_KEY]: V2_MODIFIED });
    const result = loadStore(storage, SOON);
    expect(result.persisted).toBe(false);
    expect(result.source).toBe("migrated");
    expect(result.notice).toContain(EN["notice.not-saved"]);
    expect(storage.getItem(V2_STORAGE_KEY)).toBe(V2_MODIFIED);
    expect(storage.getItem(STORE_KEY)).toBeNull();
  });

  it("keeps the v2 data when the written v3 copy does not read back as valid", () => {
    const storage = new CorruptingStorage({ [V2_STORAGE_KEY]: V2_MODIFIED });
    expect(loadStore(storage, SOON).persisted).toBe(false);
    expect(storage.getItem(V2_STORAGE_KEY)).toBe(V2_MODIFIED);
  });

  it("migrates on a later visit after a failed write, without losing anything", () => {
    const failing = new FailingWriteStorage({ [V2_STORAGE_KEY]: V2_MODIFIED });
    loadStore(failing, SOON);
    const working = new MemoryStorage(Object.fromEntries(failing.data));
    const later = loadStore(working, "2026-11-03T08:35:00.000Z");
    expect(later.source).toBe("migrated");
    expect(later.persisted).toBe(true);
    expect(taskOf(occurrenceOf(later.store, "activity-training-rescue"), "it-setup").hold?.note).toBe("Projector cable missing");
    expect(working.getItem(V2_STORAGE_KEY)).toBeNull();
  });

  it("keeps v1/v2 and writes nothing when usable legacy data cannot be migrated consistently", () => {
    const broken = JSON.parse(V2_MODIFIED);
    broken.activities[1].actions[0].criticality = "urgent"; // readable by v2, invalid in v3
    const raw = JSON.stringify(broken);
    const storage = new MemoryStorage({ [V2_STORAGE_KEY]: raw });
    const result = loadStore(storage, SOON);
    expect(result.source).toBe("restored");
    expect(result.keepLegacy).toBe(true);
    expect(result.persisted).toBe(false);
    expect(storage.getItem(V2_STORAGE_KEY)).toBe(raw);
    expect(storage.getItem(STORE_KEY)).toBeNull();
  });

  it("saveStore reports false when storage is unavailable", () => {
    expect(saveStore(null, createSeedStore(SOON), SOON)).toBe(false);
    expect(loadStore(null, SOON)).toMatchObject({ source: "fresh", persisted: false });
  });
});

describe("idempotent loading", () => {
  it("never duplicates migrated occurrences on repeated loads", () => {
    const storage = new MemoryStorage({ [V2_STORAGE_KEY]: V2_MODIFIED });
    const first = loadStore(storage, SOON);
    const second = loadStore(storage, "2026-11-03T08:31:00.000Z");
    const third = loadStore(storage, "2026-11-03T08:32:00.000Z");
    expect(first.source).toBe("migrated");
    expect(second.source).toBe("v3");
    expect(third.source).toBe("v3");
    expect(third.notice).toBeUndefined();
    expect(third.store.occurrences.map((occurrence) => occurrence.id)).toEqual(first.store.occurrences.map((occurrence) => occurrence.id));
    expect(third.store.occurrences).toEqual(first.store.occurrences);
    expect(third.store.occurrences.flatMap((occurrence) => occurrence.history).filter((event) => event.kind === "migrated")).toHaveLength(v2Activities.length);
  });

  it("uses valid v3 and does not migrate again when a v2 leftover is still present", () => {
    const storage = new MemoryStorage({ [V2_STORAGE_KEY]: V2_MODIFIED });
    const first = loadStore(storage, SOON);
    storage.setItem(V2_STORAGE_KEY, V2_MODIFIED); // e.g. an earlier removal failed
    const again = loadStore(storage, "2026-11-03T08:31:00.000Z");
    expect(again.source).toBe("v3");
    expect(again.store.occurrences).toEqual(first.store.occurrences);
    expect(storage.getItem(V2_STORAGE_KEY)).toBeNull();
  });
});

describe("v3 stale-demo handling (§11.4)", () => {
  const savedAt = "2026-11-03T08:00:00.000Z";
  const stored = (store: StoreV3) => JSON.stringify({ ...store, savedAt });

  it("continues unchanged within the 30-minute window", () => {
    const store = { ...createSeedStore(savedAt), modified: true };
    const result = resolveStore({ v3: stored(store), v2: null, v1: null }, "2026-11-03T08:30:00.000Z");
    expect(result.source).toBe("v3");
    expect(result.store.occurrences).toEqual(store.occurrences);
  });

  it("replaces a stale untouched v3 demo with a fresh seed", () => {
    const now = "2026-11-05T08:00:00.000Z";
    const result = resolveStore({ v3: stored(createSeedStore(savedAt)), v2: null, v1: null }, now);
    expect(result.source).toBe("v3-stale-fresh");
    const rescue = result.store.occurrences.find((occurrence) => occurrence.id === RESCUE_OCCURRENCE_ID)!;
    expect((new Date(rescue.anchorAt).getTime() - new Date(now).getTime()) / MINUTE).toBe(45);
  });

  it("shifts one-off occurrences of a stale modified demo and keeps recurring ones on their real dates", () => {
    const base = { ...createSeedStore(savedAt), modified: true };
    // A recurring operation with one occurrence, built by hand: recurrence generation is M2.
    const recurringOp = {
      ...base.operations[0],
      id: "op-recurring",
      schedule: {
        frequency: "monthly" as const, interval: 1, rule: { kind: "dayOfMonth" as const, day: 15 }, anchorPeriodOffset: 0 as const,
        time: "12:00", weekendShift: "previous-working-day" as const, startDate: "2026-11-01", versions: [],
      },
    };
    const recurringOcc = { ...base.occurrences[0], id: "op-recurring:2026-11", operationId: "op-recurring", periodKey: "2026-11", history: base.occurrences[0].history.map((event) => ({ ...event, id: event.id.replace(RESCUE_OCCURRENCE_ID, "op-recurring:2026-11") })) };
    const store: StoreV3 = { ...base, operations: [...base.operations, recurringOp], occurrences: [...base.occurrences, recurringOcc] };
    expect(findInvariantViolations(store)).toEqual([]);

    const awayMs = 2 * 24 * 60 * MINUTE;
    const now = new Date(new Date(savedAt).getTime() + awayMs).toISOString();
    const result = resolveStore({ v3: stored(store), v2: null, v1: null }, now);
    expect(result.source).toBe("v3-stale-shifted");
    const rescue = result.store.occurrences.find((occurrence) => occurrence.id === RESCUE_OCCURRENCE_ID)!;
    const original = store.occurrences.find((occurrence) => occurrence.id === RESCUE_OCCURRENCE_ID)!;
    expect(new Date(rescue.anchorAt).getTime() - new Date(original.anchorAt).getTime()).toBe(awayMs);
    expect(new Date(rescue.tasks[0].dueAt).getTime() - new Date(original.tasks[0].dueAt).getTime()).toBe(awayMs);
    expect(result.store.occurrences.find((occurrence) => occurrence.id === "op-recurring:2026-11")!.anchorAt).toBe(recurringOcc.anchorAt);
    expect(result.notice).toContain("moved forward by 2 d");
    expect(result.notice).toContain(EN["notice.recurring-kept"]);
  });
});
