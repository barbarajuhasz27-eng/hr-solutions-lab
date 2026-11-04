"use client";

/**
 * Client-side demo store shared by every route of the shell.
 *
 * This is the state and behaviour of the former single-page `OperationsHub` component, lifted into a
 * provider so it survives navigation between routes. Loading, saving, the 30-second clock, stale-demo
 * handling, reset and action updates are unchanged and still use `lib/storage` (v2) and `lib/engine`.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { applyActionUpdate, completeUpdate, fallbackUpdate, holdUpdate, isActionResolved, reopenUpdate, type HoldInput } from "@/lib/engine";
import type { Activity, ActionInstance, ActionUpdate } from "@/lib/model";
import { getPlaybook } from "@/lib/playbooks";
import { createActivity, resetActivities, RESCUE_LEAD_MINUTES } from "@/lib/seed";
import { clearDemo, loadDemo, saveDemo } from "@/lib/storage";

export interface Notice {
  text: string;
  /** The route the notice belongs to. It is shown there and dismissed once the visitor navigates away. */
  path: string;
}

export interface HubStore {
  hydrated: boolean;
  activities: Activity[];
  now: Date;
  notice: Notice | null;
  setNotice: (notice: Notice | null) => void;
  getActivity: (id: string) => Activity | undefined;
  updateAction: (activityId: string, actionId: string, update: ActionUpdate) => void;
  toggleAction: (activity: Activity, action: ActionInstance) => void;
  applyFallback: (activity: Activity, action: ActionInstance) => void;
  saveHold: (activity: Activity, action: ActionInstance, input: HoldInput) => void;
  releaseHold: (activity: Activity, action: ActionInstance) => void;
  /** Restores the synthetic demo. The caller decides where to navigate. */
  resetDemo: () => void;
  /** Creates an activity two weeks from now from an available playbook and returns it. */
  createFromPlaybook: (playbookId: string) => Activity | null;
}

const HubStoreContext = createContext<HubStore | null>(null);

export function HubStoreProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [hydrated, setHydrated] = useState(false);
  const [modified, setModified] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const loadedAt = new Date();
    const loaded = loadDemo(loadedAt);
    setActivities(loaded.activities);
    setModified(loaded.modified);
    if (loaded.notice) setNotice({ text: loaded.notice, path: window.location.pathname });
    setNow(loadedAt);
    setHydrated(true);
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  // Saving on every clock tick keeps `savedAt` close to the moment the visitor leaves,
  // so a returning visitor's timeline is only shifted by the time they were actually away.
  useEffect(() => {
    if (hydrated) saveDemo(activities, modified, now);
  }, [activities, modified, now, hydrated]);

  const updateAction = useCallback((activityId: string, actionId: string, update: ActionUpdate) => {
    setActivities((current) => applyActionUpdate(current, activityId, actionId, update));
    setModified(true);
  }, []);

  const store = useMemo<HubStore>(() => ({
    hydrated,
    activities,
    now,
    notice,
    setNotice,
    getActivity: (id) => activities.find((activity) => activity.id === id),
    updateAction,
    toggleAction: (activity, action) =>
      updateAction(
        activity.id,
        action.id,
        isActionResolved(action) ? reopenUpdate() : completeUpdate("Completed in the demo workspace."),
      ),
    applyFallback: (activity, action) => {
      if (!action.fallback) return;
      updateAction(activity.id, action.id, fallbackUpdate(action));
    },
    saveHold: (activity, action, input) => updateAction(activity.id, action.id, holdUpdate(input)),
    releaseHold: (activity, action) => updateAction(activity.id, action.id, reopenUpdate()),
    resetDemo: () => {
      clearDemo();
      const resetAt = new Date();
      setActivities(resetActivities(resetAt));
      setModified(false);
      setNow(resetAt);
      setNotice({ text: `Demo data restored. The training scenario starts in ${RESCUE_LEAD_MINUTES} minutes.`, path: "/" });
    },
    createFromPlaybook: (playbookId) => {
      const playbook = getPlaybook(playbookId);
      if (!playbook || playbook.actions.length === 0) return null;
      const startsAt = new Date(now.getTime() + 14 * 24 * 60 * 60_000);
      const created = createActivity(
        playbookId,
        playbook.title,
        startsAt,
        `activity-${activities.length + 1}-${now.getTime()}`,
        { location: "To be confirmed" },
      );
      setActivities((current) => [created, ...current]);
      setModified(true);
      setNotice({
        text: "New activity created from the playbook, scheduled two weeks from now.",
        path: `/o/${encodeURIComponent(created.id)}`,
      });
      return created;
    },
  }), [hydrated, activities, now, notice, updateAction]);

  return <HubStoreContext.Provider value={store}>{children}</HubStoreContext.Provider>;
}

export function useHubStore(): HubStore {
  const store = useContext(HubStoreContext);
  if (!store) throw new Error("useHubStore must be used inside <HubStoreProvider>.");
  return store;
}
