import type { Activity } from "./model";
import { createSeedActivities } from "./seed";

const STORAGE_KEY = "hr-operations-hub-demo-v1";

export function loadActivities(now: Date): Activity[] {
  if (typeof window === "undefined") return createSeedActivities(now);

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedActivities(now);
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return createSeedActivities(now);
    return parsed as Activity[];
  } catch {
    return createSeedActivities(now);
  }
}

export function saveActivities(activities: Activity[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(activities));
  } catch {
    // The prototype remains usable in memory when browser storage is unavailable.
  }
}

export function clearActivities(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // No-op: the caller still restores the in-memory demo state.
  }
}
