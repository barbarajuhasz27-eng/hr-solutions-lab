/**
 * The versioned client store `hr-operations-hub-demo-v3` (§4.4) and the load procedure (§11.2, §11.4).
 *
 * Load order:
 * 1. A valid v3 store is used (with the stale-demo rules of §11.4).
 * 2. Otherwise the existing v1/v2 resolution runs (`resolveStoredDemo`), and its result is migrated.
 * 3. The resulting v3 store is written and read back. Only after that verified write are the v1/v2 keys
 *    removed. If the write fails, the old keys stay, so the only valid copy of the visitor's data is never
 *    destroyed. Repeated loads read v3 and never migrate twice.
 *
 * Browser storage is passed in as `StorageLike`, so all of this is testable without a browser. Nothing
 * leaves the browser: there is no backend and no network call.
 */
import { formatDuration } from "../format";
import { message } from "../messages/en";
import { createSeedStore } from "../domain/seed";
import type { ISODateTime, Occurrence, Operation, StoreV3, Task } from "../domain/types";
import { parseStoreV3 } from "../domain/validate";
import { resolveStoredDemo, STALE_AFTER_MINUTES, V1_STORAGE_KEY, V2_STORAGE_KEY } from "../storage";
import { storeFromLegacy } from "./migrate";

export const STORE_KEY = "hr-operations-hub-demo-v3";
export const LEGACY_KEYS = [V2_STORAGE_KEY, V1_STORAGE_KEY] as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadSource =
  /** A valid v3 store, used as it was. */
  | "v3"
  /** A stale, untouched v3 store, replaced by a fresh seed. */
  | "v3-stale-fresh"
  /** A stale, modified v3 store whose one-off occurrences were moved forward. */
  | "v3-stale-shifted"
  /** Modified v1/v2 data migrated into v3. */
  | "migrated"
  /** Nothing stored, or untouched v1/v2 data: a fresh seed. */
  | "fresh"
  /** Stored data could not be read: a fresh seed. */
  | "restored";

export interface ResolvedStore {
  store: StoreV3;
  source: LoadSource;
  notice?: string;
  /** True when v1/v2 data was usable but could not be migrated: its keys must be kept. */
  keepLegacy?: boolean;
}

export interface LoadResult extends ResolvedStore {
  /** Whether the v3 store was written and verified. */
  persisted: boolean;
}

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const shiftInstant = (iso: string, ms: number) => new Date(new Date(iso).getTime() + ms).toISOString();

function shiftTask(task: Task, ms: number): Task {
  return {
    ...task,
    dueAt: shiftInstant(task.dueAt, ms),
    ...(task.resolvedAt ? { resolvedAt: shiftInstant(task.resolvedAt, ms) } : {}),
    ...(task.hold ? { hold: { ...task.hold, since: shiftInstant(task.hold.since, ms) } } : {}),
  };
}

/** Moves every instant of an occurrence by the same amount, keeping its relative timeline. */
export function shiftOccurrence(occurrence: Occurrence, ms: number): Occurrence {
  return {
    ...occurrence,
    anchorAt: shiftInstant(occurrence.anchorAt, ms),
    ...(occurrence.originalAnchorAt ? { originalAnchorAt: shiftInstant(occurrence.originalAnchorAt, ms) } : {}),
    ...(occurrence.closedAt ? { closedAt: shiftInstant(occurrence.closedAt, ms) } : {}),
    tasks: occurrence.tasks.map((task) => shiftTask(task, ms)),
    coverage: occurrence.coverage.map((item) => ({ ...item, createdAt: shiftInstant(item.createdAt, ms) })),
    history: occurrence.history.map((event) => ({ ...event, at: shiftInstant(event.at, ms) })),
  };
}

/**
 * §11.4 for a modified stale v3 store: one-off occurrences are shifted by the time away; recurring
 * occurrences keep their real calendar dates, and the schedule engine generates the current periods on load.
 */
export function shiftStaleStore(store: StoreV3, awayMs: number): { store: StoreV3; recurringKept: boolean } {
  const operations = new Map<string, Operation>(store.operations.map((operation) => [operation.id, operation]));
  const isOneOff = (occurrence: Occurrence) => operations.get(occurrence.operationId)?.schedule === null;
  return {
    store: {
      ...store,
      operations: store.operations.map((operation) =>
        operation.schedule === null ? { ...operation, createdAt: shiftInstant(operation.createdAt, awayMs) } : operation,
      ),
      occurrences: store.occurrences.map((occurrence) => (isOneOff(occurrence) ? shiftOccurrence(occurrence, awayMs) : occurrence)),
    },
    recurringKept: store.operations.some((operation) => operation.schedule !== null),
  };
}

/** Pure resolution of what the visitor sees, from the raw stored strings. */
export function resolveStore(raw: { v3: string | null; v2: string | null; v1: string | null }, now: ISODateTime): ResolvedStore {
  const nowDate = new Date(now);
  const v3 = parseStoreV3(parseJson(raw.v3));
  if (v3) {
    const awayMs = Math.max(0, nowDate.getTime() - new Date(v3.savedAt).getTime());
    const awayMinutes = awayMs / 60_000;
    if (awayMinutes <= STALE_AFTER_MINUTES) return { store: v3, source: "v3" };
    if (!v3.modified) return { store: createSeedStore(now), source: "v3-stale-fresh" };
    const shifted = shiftStaleStore(v3, awayMs);
    return {
      store: shifted.store,
      source: "v3-stale-shifted",
      notice: [
        message("notice.welcome-back"),
        message("notice.timeline-shifted", { duration: formatDuration(awayMinutes) }),
        shifted.recurringKept ? message("notice.recurring-kept") : undefined,
        message("notice.reset-hint"),
      ].filter(Boolean).join(" "),
    };
  }

  const legacy = resolveStoredDemo(raw.v2, raw.v1, nowDate);
  if (legacy.source !== "fresh") {
    const resolved = storeFromLegacy(legacy, now);
    // Migrated data is validated like stored data. If it is not consistent, the fresh seed is shown and the
    // old keys are left untouched (the caller only removes them after a verified write of migrated data).
    if (resolved.migrated && !parseStoreV3(resolved.store)) {
      return { store: createSeedStore(now), source: "restored", notice: message("notice.restored"), keepLegacy: true };
    }
    return { store: resolved.store, source: resolved.migrated ? "migrated" : "fresh", ...(resolved.notice ? { notice: resolved.notice } : {}) };
  }

  const somethingUnreadable = raw.v3 !== null || raw.v2 !== null || raw.v1 !== null;
  return somethingUnreadable
    ? { store: createSeedStore(now), source: "restored", notice: message("notice.restored") }
    : { store: createSeedStore(now), source: "fresh" };
}

function safeGet(storage: StorageLike, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Writes the store with `savedAt = now`, then reads it back and validates it. Returns true only when the
 * stored copy is a valid v3 store with the expected `savedAt`.
 */
export function saveStore(storage: StorageLike | null, store: StoreV3, now: ISODateTime): boolean {
  if (!storage) return false;
  const toSave: StoreV3 = { ...store, savedAt: now };
  try {
    storage.setItem(STORE_KEY, JSON.stringify(toSave));
    const readBack = parseStoreV3(parseJson(storage.getItem(STORE_KEY)));
    return readBack !== null && readBack.savedAt === now;
  } catch {
    return false;
  }
}

/**
 * Loads the store and persists the result. The v1/v2 keys are removed only after a verified v3 write,
 * and only when the data that was written does not depend on a failed migration.
 */
export function loadStore(storage: StorageLike | null, now: ISODateTime): LoadResult {
  if (!storage) {
    const resolved = resolveStore({ v3: null, v2: null, v1: null }, now);
    return { ...resolved, persisted: false };
  }
  const raw = { v3: safeGet(storage, STORE_KEY), v2: safeGet(storage, V2_STORAGE_KEY), v1: safeGet(storage, V1_STORAGE_KEY) };
  const resolved = resolveStore(raw, now);
  const store: StoreV3 = { ...resolved.store, savedAt: now };

  // After a failed migration the v1/v2 data is still the only copy of the visitor's changes. Nothing is
  // written, so the legacy keys stay authoritative and the next load tries again.
  const legacyPresent = raw.v2 !== null || raw.v1 !== null;
  const persisted = resolved.keepLegacy ? false : saveStore(storage, store, now);
  if (persisted && legacyPresent && !resolved.keepLegacy) {
    for (const key of LEGACY_KEYS) {
      try {
        storage.removeItem(key);
      } catch {
        // Removal is retried on the next load; v3 is already valid, so nothing is migrated twice.
      }
    }
  }
  const notice = persisted ? resolved.notice : [resolved.notice, message("notice.not-saved")].filter(Boolean).join(" ");
  return { ...resolved, store, persisted, ...(notice ? { notice } : {}) };
}

/** Removes the v3 store and any v1/v2 leftovers (Reset demo). */
export function clearStore(storage: StorageLike | null): void {
  if (!storage) return;
  for (const key of [STORE_KEY, ...LEGACY_KEYS]) {
    try {
      storage.removeItem(key);
    } catch {
      // No-op: the caller still restores the in-memory demo state.
    }
  }
}

/** `window.localStorage`, or null where it is unavailable (server rendering, privacy modes). */
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
