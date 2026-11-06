"use client";

import { X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useHubStore } from "./hub-store";
import { TopBar } from "./top-bar";

/** Calm workspace frame: 48 px top bar, then content up to 1440 px wide. */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { notice, setNotice } = useHubStore();

  // A notice belongs to one route; it is dismissed once the visitor navigates elsewhere.
  // Only a route change clears it, so a notice set just before navigating to its route survives.
  const previousPath = useRef(pathname);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (notice && notice.path !== pathname) setNotice(null);
  }, [pathname, notice, setNotice]);

  return (
    <div className="workspace" data-mode="workspace">
      <a className="skip-link" href="#main">Skip to content</a>
      <TopBar />
      <main className="content" id="main">
        {notice && notice.path === pathname && (
          <div className="inline-notice" role="status">
            <span>{notice.text}</span>
            <button className="icon-button" type="button" aria-label="Dismiss notice" onClick={() => setNotice(null)}>
              <X size={14} aria-hidden />
            </button>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
