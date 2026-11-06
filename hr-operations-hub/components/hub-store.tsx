"use client";

/**
 * Client-side demo store shared by every route of the shell.
 *
 * Since M1 the authoritative state is the v3 store (`StoreV3`, §4.4). It is loaded and migrated by
 * `lib/store/persistence`, and every change goes through the pure reducer (`lib/domain/reducer`) with an
 * explicit `now` and the simulated actor. The M0 screens read `activities`, a derived view produced by the
 * temporary activity adapter, until M3 replaces the engine.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DomainError } from "@/lib/domain/occurrence";
import { applyAction, type HoldInput, type HubAction } from "@/lib/domain/reducer";
import { createSeedStore, CURRENT_USER_ID, RESCUE_LEAD_MINUTES } from "@/lib/domain/seed";
import type { StoreV3 } from "@/lib/domain/types";
import { message } from "@/lib/messages/en";
import type { Activity, ActionInstance } from "@/lib/model";
import { advanceSchedule } from "@/lib/schedule/generation";
import { toActivities } from "@/lib/store/activity-adapter";
import { browserStorage, clearStore, loadStore, saveStore } from "@/lib/store/persistence";

export interface Notice {
  text: string;
  /** The route the notice belongs to. It is shown there and dismissed once the visitor navigates away. */
  path: string;
}

export interface HubStore {
  hydrated: boolean;
  /** The authoritative v3 store. */
  store: StoreV3;
  /** Applies a reducer action as the simulated user at the current time. Returns false when it was rejected. */
  dispatch: (action: HubAction) => boolean;
  /** M0 view model derived from `store` (temporary adapter). */
  activities: Activity[];
  now: Date;
  notice: Notice | null;
  setNotice: (notice: Notice | null) => void;
  getActivity: (id: string) => Activity | undefined;
  toggleAction: (activity: Activity, action: ActionInstance) => void;
  completeAction: (activity: Activity, action: ActionInstance, from?: "workspace" | "recovery") => void;
  applyFallback: (activity: Activity, action: ActionInstance) => void;
  saveHold: (activity: Activity, action: ActionInstance, input: HoldInput) => void;
  releaseHold: (activity: Activity, action: ActionInstance) => void;
  /** Restores the synthetic demo. The caller decides where to navigate. */
  resetDemo: () => void;
  /** Creates a one-off operation two weeks from now from an available playbook and returns its occurrence. */
  createFromPlaybook: (playbookId: string) => Activity | null;
}

const HubStoreContext = createContext<HubStore | null>(null);

const TWO_WEEKS_MS = 14 * 24 * 60 * 60_000;

export function HubStoreProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<StoreV3>(() => createSeedStore(new Date()));
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  // After a failed migration the v1/v2 keys stay authoritative and nothing is written (lib/store/persistence).
  const persistBlocked = useRef(false);
  // The reducer runs outside React's updater so a rejected action can be reported synchronously.
  const storeRef = useRef(store);

  const commit = useCallback((next: StoreV3) => {
    storeRef.current = next;
    setStore(next);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const loadedAt = new Date();
    const loaded = loadStore(browserStorage(), loadedAt.toISOString());
    persistBlocked.current = loaded.keepLegacy === true;
    // Generation and activation run on app load (§6.4), also for a store that was just migrated or shifted.
    commit(advanceSchedule(loaded.store, loadedAt.toISOString(), CURRENT_USER_ID).store);
    if (loaded.notice) setNotice({ text: loaded.notice, path: window.location.pathname });
    setNow(loadedAt);
    setHydrated(true);
  }, [commit]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const interval = window.setInterval(() => {
      const tickAt = new Date();
      // ...and on each clock tick. Idempotent: the same store comes back when nothing is due.
      const advanced = advanceSchedule(storeRef.current, tickAt.toISOString(), CURRENT_USER_ID).store;
      if (advanced !== storeRef.current) commit(advanced);
      setNow(tickAt);
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [commit]);

  // Saving on every clock tick keeps `savedAt` close to the moment the visitor leaves,
  // so a returning visitor's timeline is only shifted by the time they were actually away.
  useEffect(() => {
    if (hydrated && !persistBlocked.current) saveStore(browserStorage(), store, now.toISOString());
  }, [store, now, hydrated]);

  const dispatch = useCallback((action: HubAction): boolean => {
    try {
      commit(applyAction(storeRef.current, action, { now: new Date().toISOString(), actorId: CURRENT_USER_ID }));
      return true;
    } catch (error) {
      if (error instanceof DomainError) return false;
      throw error;
    }
  }, [commit]);

  const activities = useMemo(() => toActivities(store), [store]);

  const value = useMemo<HubStore>(() => {
    const target = (activity: Activity, action: ActionInstance) => ({ occurrenceId: activity.id, taskId: action.id });
    const completeAction: HubStore["completeAction"] = (activity, action, from = "workspace") =>
      void dispatch({
        type: "completeTask",
        ...target(activity, action),
        note: message(from === "recovery" ? "note.completed-recovery" : "note.completed-workspace"),
      });
    return {
      hydrated,
      store,
      dispatch,
      activities,
      now,
      notice,
      setNotice,
      getActivity: (id) => activities.find((activity) => activity.id === id),
      toggleAction: (activity, action) =>
        action.status === "done" || action.status === "skipped"
          ? void dispatch({ type: "reopenTask", ...target(activity, action) })
          : completeAction(activity, action),
      completeAction,
      applyFallback: (activity, action) => {
        if (!action.fallback) return;
        dispatch({ type: "useFallback", ...target(activity, action) });
      },
      saveHold: (activity, action, input) => void dispatch({ type: "setHold", ...target(activity, action), hold: input }),
      releaseHold: (activity, action) => void dispatch({ type: "releaseHold", ...target(activity, action) }),
      resetDemo: () => {
        const storage = browserStorage();
        clearStore(storage);
        persistBlocked.current = false;
        const resetAt = new Date();
        commit(createSeedStore(resetAt));
        setNow(resetAt);
        setNotice({ text: message("notice.reset", { minutes: RESCUE_LEAD_MINUTES }), path: "/" });
      },
      createFromPlaybook: (playbookId) => {
        const playbook = store.playbooks.find((item) => item.id === playbookId && item.status === "available" && item.tasks.length > 0);
        if (!playbook) return null;
        const createdAt = new Date();
        const operationId = `op-${store.operations.length + 1}-${createdAt.getTime()}`;
        const ok = dispatch({
          type: "createOperation",
          operation: { id: operationId, title: playbook.title, playbookId, ownerId: CURRENT_USER_ID },
          anchorAt: new Date(createdAt.getTime() + TWO_WEEKS_MS).toISOString(),
          location: "To be confirmed",
        });
        if (!ok) return null;
        const created = toActivities(storeRef.current).find((activity) => activity.id === `${operationId}:once`) ?? null;
        if (created) setNotice({ text: message("notice.created"), path: `/o/${encodeURIComponent(created.id)}` });
        return created;
      },
    };
  }, [hydrated, store, dispatch, activities, now, notice, commit]);

  return <HubStoreContext.Provider value={value}>{children}</HubStoreContext.Provider>;
}

export function useHubStore(): HubStore {
  const store = useContext(HubStoreContext);
  if (!store) throw new Error("useHubStore must be used inside <HubStoreProvider>.");
  return store;
}
