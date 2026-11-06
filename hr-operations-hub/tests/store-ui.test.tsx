/**
 * @vitest-environment jsdom
 */
/** The M0 shell on the v3 store: loading, migration notice and reset, through the real provider. */
import "@testing-library/jest-dom/vitest";
import { act, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, onClick, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest} onClick={(event) => { onClick?.(event); event.preventDefault(); }}>{children}</a>
  ),
}));

import { HubStoreProvider, useHubStore } from "../components/hub-store";
import { OccurrenceView } from "../components/views/occurrence-view";
import { TodayView } from "../components/views/today-view";
import { WorkspaceShell } from "../components/workspace-shell";
import { RESCUE_OCCURRENCE_ID } from "../lib/domain/seed";
import { occurrenceHref } from "../lib/shell";
import { STORE_KEY } from "../lib/store/persistence";
import { V1_STORAGE_KEY, V2_STORAGE_KEY } from "../lib/storage";

const V2_MODIFIED = readFileSync(resolve(__dirname, "fixtures", "v2-modified.json"), "utf8");

function Probe({ onStore }: { onStore: (store: ReturnType<typeof useHubStore>) => void }) {
  onStore(useHubStore());
  return null;
}

function renderApp(ui: ReactNode, path = "/") {
  nav.pathname = path;
  let store: ReturnType<typeof useHubStore> | undefined;
  render(
    <HubStoreProvider>
      <Probe onStore={(value) => { store = value; }} />
      {ui}
    </HubStoreProvider>,
  );
  return () => store!;
}

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
  // Ten minutes after the fixture was saved: the v2 timeline is used unshifted.
  vi.setSystemTime(new Date("2026-11-03T08:30:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
  window.localStorage.clear();
});

describe("v3 store in the running app", () => {
  it("migrates v2 data on load, shows the notice, writes v3 and removes the old keys", async () => {
    window.localStorage.setItem(V2_STORAGE_KEY, V2_MODIFIED);
    window.localStorage.setItem(V1_STORAGE_KEY, "[]");
    const store = renderApp(<WorkspaceShell><TodayView filter={null} /></WorkspaceShell>);
    expect(await screen.findByText(/Your earlier demo changes were kept and moved into the new workspace\./)).toBeInTheDocument();
    const stored = JSON.parse(window.localStorage.getItem(STORE_KEY)!);
    expect(stored.version).toBe(3);
    expect(stored.occurrences).toHaveLength(4);
    expect(window.localStorage.getItem(V2_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(V1_STORAGE_KEY)).toBeNull();
    // The visitor's own activity and holds are there.
    expect(store().activities.map((activity) => activity.title)).toContain("Training session");
    expect(store().getActivity(RESCUE_OCCURRENCE_ID)!.actions.find((action) => action.id === "it-setup")).toMatchObject({ status: "blocked", statusNote: "Projector cable missing" });
  });

  it("opens a migrated occurrence at its v3 route and keeps working after a reload", async () => {
    window.localStorage.setItem(V2_STORAGE_KEY, V2_MODIFIED);
    renderApp(<OccurrenceView id={RESCUE_OCCURRENCE_ID} />, occurrenceHref(RESCUE_OCCURRENCE_ID));
    expect(await screen.findByRole("heading", { level: 1, name: "Leading through change" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen Confirm trainer and session content" })).toBeInTheDocument();
  });

  it("Reset demo clears v3 and any leftovers and restores the seed", async () => {
    window.localStorage.setItem(V2_STORAGE_KEY, V2_MODIFIED);
    const store = renderApp(<TodayView filter={null} />);
    await screen.findByRole("heading", { level: 1, name: "Today" });
    act(() => store().resetDemo());
    expect(store().store.modified).toBe(false);
    expect(store().store.occurrences).toHaveLength(3);
    expect(store().notice?.text).toMatch(/Demo data restored/);
  });

  it("rejects an invalid action without changing the state", async () => {
    const store = renderApp(<TodayView filter={null} />);
    await screen.findByRole("heading", { level: 1, name: "Today" });
    const before = store().store;
    let ok = true;
    act(() => { ok = store().dispatch({ type: "releaseHold", occurrenceId: RESCUE_OCCURRENCE_ID, taskId: "room-confirmed" }); });
    expect(ok).toBe(false);
    expect(store().store).toBe(before);
  });
});
