import { PREVIEW_ROLES, type PreviewRole } from "@/lib/access";
import { diffInDays } from "@/lib/dates";
import { isCaseActive } from "@/lib/metrics";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

/*
 * Demo Mode: which simulated preview is shown, and which fictional new hire the portal shows.
 * This is a per-browser convenience setting, stored separately from the workspace data so that
 * "Reset demo data" does not change the preview. It is not authentication.
 */

export const PREVIEW_STORAGE_KEY = "smart-onboarding:preview";

export type DemoPreview = {
  role: PreviewRole;
  /** The case shown in the New Hire preview. Null = pick a sensible default. */
  caseId: string | null;
};

/** The portal is the primary experience, so the demo opens as a new hire who has just started. */
export const DEFAULT_PREVIEW: DemoPreview = { role: "new-hire", caseId: "demo-daniel-okafor" };

export function parsePreview(raw: string | null): DemoPreview {
  if (raw === null) return { ...DEFAULT_PREVIEW };
  try {
    const value = JSON.parse(raw) as Partial<DemoPreview> | null;
    if (value && (PREVIEW_ROLES as readonly string[]).includes(value.role as string)) {
      const caseId = typeof value.caseId === "string" && value.caseId.length > 0 ? value.caseId : null;
      return { role: value.role as PreviewRole, caseId };
    }
  } catch {
    // fall through to the default
  }
  return { ...DEFAULT_PREVIEW };
}

/**
 * The case shown in the New Hire preview: the chosen case if it still exists; otherwise the
 * active case that started most recently; otherwise the next upcoming start; otherwise any case.
 */
export function resolvePreviewCase(
  cases: readonly OnboardingCase[],
  preferredId: string | null,
  today: ISODate,
): OnboardingCase | null {
  const preferred = preferredId ? cases.find((c) => c.id === preferredId) : undefined;
  if (preferred) return preferred;
  const active = cases.filter(isCaseActive);
  const started = active
    .filter((c) => diffInDays(c.startDate, today) >= 0)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (started[0]) return started[0];
  const upcoming = [...active].sort((a, b) => a.startDate.localeCompare(b.startDate));
  return upcoming[0] ?? cases[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Client-side external store                                          */
/* ------------------------------------------------------------------ */

type Listener = () => void;

let state: DemoPreview | null = null;
const listeners = new Set<Listener>();

function storage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function read(): DemoPreview {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(PREVIEW_STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  return parsePreview(raw);
}

function write(next: DemoPreview) {
  state = next;
  try {
    storage()?.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // The preview still works in memory when storage is unavailable.
  }
  for (const listener of listeners) listener();
}

export const demoModeStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      if (event.key === PREVIEW_STORAGE_KEY) {
        state = read();
        listener();
      }
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  },

  getSnapshot(): DemoPreview {
    if (state === null) state = read();
    return state;
  },

  /** The preview is unknown on the server; components render a neutral loading state. */
  getServerSnapshot(): DemoPreview | null {
    return null;
  },

  setRole(role: PreviewRole) {
    const current = demoModeStore.getSnapshot();
    if (current.role !== role) write({ ...current, role });
  },

  /** Switches to the New Hire preview for a specific case. */
  previewCase(caseId: string) {
    write({ role: "new-hire", caseId });
  },

  /** Test helper: forget the in-memory cache so the next read hits storage. */
  _resetForTests() {
    state = null;
  },
};
