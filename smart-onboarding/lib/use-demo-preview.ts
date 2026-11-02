"use client";

import { useSyncExternalStore } from "react";
import { demoModeStore, type DemoPreview } from "@/lib/demo-mode";

const getSnapshot = (): DemoPreview | null => demoModeStore.getSnapshot();
const getServerSnapshot = (): DemoPreview | null => demoModeStore.getServerSnapshot();

/** The current Demo Mode preview, or null on the server and during hydration. */
export function useDemoPreview(): DemoPreview | null {
  return useSyncExternalStore(demoModeStore.subscribe, getSnapshot, getServerSnapshot);
}

export const demoModeActions = {
  setRole: demoModeStore.setRole,
  previewCase: demoModeStore.previewCase,
};
