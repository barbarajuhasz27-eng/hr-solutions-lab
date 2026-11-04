"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Workspace theme (8.2): light by default, follows the system, or a stored choice.
 * Recovery mode ignores this and is always dark. The preference is stored separately from the demo
 * data, so the v2 demo storage is unchanged.
 */
export const THEME_STORAGE_KEY = "hr-operations-hub-theme";
export type ThemePreference = "system" | "light" | "dark";
const ORDER: ThemePreference[] = ["system", "light", "dark"];

/** Runs before first paint so a stored theme does not flash. */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}`;

export function readThemePreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export function applyThemePreference(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === "system") delete root.dataset.theme;
  else root.dataset.theme = preference;
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // The choice still applies for this visit when storage is unavailable.
  }
}

const LABEL: Record<ThemePreference, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => setPreference(readThemePreference()), []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const next = ORDER[(ORDER.indexOf(preference) + 1) % ORDER.length];
  const Icon = preference === "light" ? Sun : preference === "dark" ? Moon : Monitor;
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={`${LABEL[preference]}. Switch to ${LABEL[next].toLowerCase()}`}
      title={`${LABEL[preference]} — switch to ${LABEL[next].toLowerCase()}`}
      onClick={() => {
        applyThemePreference(next);
        setPreference(next);
      }}
    >
      <Icon size={15} aria-hidden />
    </button>
  );
}
