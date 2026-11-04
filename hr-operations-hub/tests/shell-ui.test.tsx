/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({ pathname: "/", search: "", push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

vi.mock("next/link", () => ({
  // A plain anchor; the default navigation is prevented because jsdom cannot change documents.
  default: ({ href, children, onClick, ...rest }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={href} {...rest} onClick={(event) => { onClick?.(event); event.preventDefault(); }}>{children}</a>
  ),
}));

import { HubStoreProvider, useHubStore } from "../components/hub-store";
import { THEME_STORAGE_KEY, ThemeToggle } from "../components/theme";
import { NAV_SECTIONS, TopBar } from "../components/top-bar";
import { ComingSoonView } from "../components/views/coming-soon";
import { OccurrenceView } from "../components/views/occurrence-view";
import { PlaybooksView } from "../components/views/playbooks-view";
import { RecoveryView } from "../components/views/recovery-view";
import { TodayView } from "../components/views/today-view";
import { WorkspaceShell } from "../components/workspace-shell";
import { RESCUE_ACTIVITY_ID } from "../lib/seed";
import { getExceptionCounts, type ExceptionFilter } from "../lib/shell";
import { STORAGE_KEY } from "../lib/storage";

function Probe({ onStore }: { onStore: (store: ReturnType<typeof useHubStore>) => void }) {
  onStore(useHubStore());
  return null;
}

function renderApp(ui: ReactNode, { path = "/", search = "" } = {}) {
  nav.pathname = path;
  nav.search = search;
  let store: ReturnType<typeof useHubStore> | undefined;
  const tree = (content: ReactNode) => (
    <HubStoreProvider>
      <Probe onStore={(value) => { store = value; }} />
      {content}
    </HubStoreProvider>
  );
  const result = render(tree(ui));
  /** Simulates a client-side route change: same provider, new pathname and page. */
  const navigate = (nextPath: string, nextUi: ReactNode) => {
    nav.pathname = nextPath;
    result.rerender(tree(nextUi));
  };
  return { ...result, navigate, store: () => store! };
}

beforeEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset.theme;
  nav.push.mockReset();
});

afterEach(() => {
  window.localStorage.clear();
});

describe("Top bar and navigation", () => {
  it("shows the five sections in order, with Today as the default route", async () => {
    renderApp(<WorkspaceShell><TodayView filter={null} /></WorkspaceShell>);
    const main = screen.getByRole("navigation", { name: "Main navigation" });
    const links = within(main).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Today", "Calendar", "Portfolio", "People", "Playbooks"]);
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/", "/calendar", "/portfolio", "/people", "/playbooks"]);
    expect(within(main).getByRole("link", { name: "Today" })).toHaveAttribute("aria-current", "page");
    expect(NAV_SECTIONS[0].href).toBe("/");
    expect(await screen.findByRole("heading", { level: 1, name: "Today" })).toBeInTheDocument();
  });

  it("marks the current section for other routes and the /today alias", () => {
    renderApp(<TopBar />, { path: "/playbooks" });
    const main = screen.getByRole("navigation", { name: "Main navigation" });
    expect(within(main).getByRole("link", { name: "Playbooks" })).toHaveAttribute("aria-current", "page");
    expect(within(main).getByRole("link", { name: "Today" })).not.toHaveAttribute("aria-current");
  });

  it("keeps the current user chip, demo clock and Reset demo available", async () => {
    const user = userEvent.setup();
    const { store } = renderApp(<TopBar />, { path: "/playbooks" });
    expect(screen.getByText("Sophie Lang · HR Generalist")).toBeInTheDocument();
    expect(screen.getByLabelText(/^Demo clock/)).toBeInTheDocument();

    const before = store().activities;
    await user.click(screen.getByRole("button", { name: /Reset demo/ }));
    expect(nav.push).toHaveBeenCalledWith("/");
    expect(store().activities).not.toBe(before);
    expect(store().notice?.text).toMatch(/Demo data restored/);
  });

  it("collapses navigation into a menu button that opens and closes the section list", async () => {
    const user = userEvent.setup();
    renderApp(<TopBar />);
    const menuButton = screen.getByRole("button", { name: "Open menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Main navigation (menu)" })).not.toBeInTheDocument();

    await user.click(menuButton);
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("navigation", { name: "Main navigation (menu)" });
    expect(within(menu).getAllByRole("link").map((link) => link.textContent)).toEqual(["Today", "Calendar", "Portfolio", "People", "Playbooks"]);

    await user.click(within(menu).getByRole("link", { name: "Calendar" }));
    expect(screen.queryByRole("navigation", { name: "Main navigation (menu)" })).not.toBeInTheDocument();
  });
});

describe("Exception strip", () => {
  it("derives the three counters from the loaded demo data", async () => {
    const { store } = renderApp(<TopBar />);
    const overdue = screen.getByTestId("exception-overdue");
    await vi.waitFor(() => expect(overdue.textContent).not.toContain("–"));
    const counts = getExceptionCounts(store().activities, store().now);
    expect(overdue).toHaveTextContent(`Overdue${counts.overdue}`);
    expect(screen.getByTestId("exception-at-risk")).toHaveTextContent(`At risk${counts["at-risk"]}`);
    expect(screen.getByTestId("exception-waiting")).toHaveTextContent(`Waiting on others${counts.waiting}`);
    expect(counts.overdue).toBeGreaterThan(0);
  });

  it("keeps a zero counter visible but muted, and updates when a Waiting hold is set", async () => {
    const { store } = renderApp(<TopBar />);
    const waiting = screen.getByTestId("exception-waiting");
    await vi.waitFor(() => expect(waiting).toHaveTextContent("Waiting on others0"));
    expect(waiting).toBeVisible();
    expect(waiting).toHaveClass("is-zero");
    expect(screen.getByTestId("exception-at-risk")).not.toHaveClass("is-zero");

    const activity = store().getActivity(RESCUE_ACTIVITY_ID)!;
    const action = activity.actions.find((item) => item.id === "room-confirmed")!;
    act(() => store().saveHold(activity, action, { kind: "waiting", waitingOn: "Facilities" }));
    expect(waiting).toHaveTextContent("Waiting on others1");
    expect(waiting).not.toHaveClass("is-zero");
  });

  it("links each counter to Today filtered to those items", () => {
    renderApp(<TopBar />, { path: "/", search: "show=waiting" });
    expect(screen.getByTestId("exception-overdue")).toHaveAttribute("href", "/?show=overdue");
    expect(screen.getByTestId("exception-at-risk")).toHaveAttribute("href", "/?show=at-risk");
    expect(screen.getByTestId("exception-waiting")).toHaveAttribute("href", "/?show=waiting");
    expect(screen.getByTestId("exception-waiting")).toHaveAttribute("aria-current", "page");
  });
});

describe("Today filters", () => {
  async function renderToday(filter: ExceptionFilter | null) {
    const result = renderApp(<TodayView filter={filter} />, { path: "/", search: filter ? `show=${filter}` : "" });
    await screen.findByRole("heading", { level: 1, name: "Today" });
    return result;
  }

  it("shows the priority decision, the occurrence table and playbooks without a filter", async () => {
    await renderToday(null);
    expect(screen.getByRole("heading", { name: /Leading through change starts in/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open recovery/ })).toHaveAttribute("href", `/o/${RESCUE_ACTIVITY_ID}/recovery`);
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("row")).toHaveLength(4);
    expect(within(table).getByRole("link", { name: "Excel essentials for managers" })).toHaveAttribute("href", "/o/activity-training-upcoming");
  });

  it("filters to overdue tasks", async () => {
    const { store } = await renderToday("overdue");
    const count = getExceptionCounts(store().activities, store().now).overdue;
    const list = screen.getByRole("list", { name: "Overdue tasks" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(count);
    expect(screen.getByRole("link", { name: "Clear filter" })).toHaveAttribute("href", "/");
  });

  it("filters to at-risk occurrences", async () => {
    await renderToday("at-risk");
    const list = screen.getByRole("list", { name: "Occurrences at risk" });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveTextContent("Leading through change");
  });

  it("filters to waiting tasks and shows an empty state when there are none", async () => {
    const { store } = await renderToday("waiting");
    expect(screen.getByText("No task is on a Waiting hold.")).toBeInTheDocument();
    const activity = store().getActivity(RESCUE_ACTIVITY_ID)!;
    const action = activity.actions.find((item) => item.id === "it-setup")!;
    act(() => store().saveHold(activity, action, { kind: "waiting", waitingOn: "IT Service Desk", note: "Ticket raised" }));
    const list = screen.getByRole("list", { name: "Tasks waiting on others" });
    expect(within(list).getByText(action.title)).toBeInTheDocument();
    expect(within(list).getByText(/Waiting on IT Service Desk — Ticket raised/)).toBeInTheDocument();
  });
});

describe("Ported features at their new routes", () => {
  it("lists playbooks, shows tasks and creates an activity that opens at /o/[id]", async () => {
    const user = userEvent.setup();
    const { store } = renderApp(<PlaybooksView />, { path: "/playbooks" });
    await screen.findByRole("heading", { level: 1, name: "Playbooks" });

    await user.click(screen.getByRole("button", { name: "Show tasks" }));
    expect(screen.getByRole("cell", { name: "Confirm trainer and session content" })).toBeInTheDocument();

    const createButtons = screen.getAllByRole("button", { name: /Create activity/ });
    expect(createButtons.filter((button) => !(button as HTMLButtonElement).disabled)).toHaveLength(1);
    const before = store().activities.length;
    await user.click(createButtons[0]);
    expect(store().activities).toHaveLength(before + 1);
    const created = store().activities[0];
    expect(nav.push).toHaveBeenCalledWith(`/o/${created.id}`);
    expect(store().notice).toEqual({ text: expect.stringMatching(/New activity created/), path: `/o/${created.id}` });
  });

  it("shows a notice on the route it belongs to and dismisses it after navigating away", async () => {
    const user = userEvent.setup();
    const { store, navigate } = renderApp(<WorkspaceShell><PlaybooksView /></WorkspaceShell>, { path: "/playbooks" });
    await screen.findByRole("heading", { level: 1, name: "Playbooks" });
    await user.click(screen.getAllByRole("button", { name: /Create activity/ })[0]);
    const created = store().activities[0];

    // The notice is set just before navigating; it must survive that navigation.
    navigate(`/o/${created.id}`, <WorkspaceShell><OccurrenceView id={created.id} /></WorkspaceShell>);
    expect(await screen.findByText(/New activity created from the playbook/)).toBeInTheDocument();

    navigate("/", <WorkspaceShell><TodayView filter={null} /></WorkspaceShell>);
    expect(screen.queryByText(/New activity created from the playbook/)).not.toBeInTheDocument();
    expect(store().notice).toBeNull();
  });

  it("updates action status, holds and releases in the occurrence workspace", async () => {
    const user = userEvent.setup();
    renderApp(<OccurrenceView id={RESCUE_ACTIVITY_ID} />, { path: `/o/${RESCUE_ACTIVITY_ID}` });
    await screen.findByRole("heading", { level: 1, name: "Leading through change" });
    expect(screen.getByText("Preparation timeline")).toBeInTheDocument();
    expect(screen.getAllByText(/Needs first:/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Mark Confirm trainer and session content done" }));
    expect(screen.getByRole("button", { name: "Reopen Confirm trainer and session content" })).toBeInTheDocument();

    const row = screen.getByText("Confirm room or virtual meeting", { selector: ".task-title" }).closest("li")!;
    await user.click(within(row).getByRole("button", { name: "Waiting / blocked" }));
    const form = within(row).getByRole("form", { name: /on hold/ });
    await user.click(within(form).getByLabelText(/Blocked/));
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Add a short note");
    await user.type(within(form).getByLabelText("What is blocking this action?"), "Room double-booked");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(within(row).getByText("Blocked", { selector: "strong" })).toBeInTheDocument();

    await user.click(within(row).getByRole("button", { name: /Release hold/ }));
    expect(within(row).getByRole("button", { name: "Waiting / blocked" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open recovery/ })).toHaveAttribute("href", `/o/${RESCUE_ACTIVITY_ID}/recovery`);
  });

  it("opens Rapid Recovery in the dark recovery mode and leaves to the occurrence", async () => {
    const user = userEvent.setup();
    const { container, store } = renderApp(<RecoveryView id={RESCUE_ACTIVITY_ID} />, { path: `/o/${RESCUE_ACTIVITY_ID}/recovery` });
    await screen.findByRole("heading", { level: 1, name: "Leading through change" });

    expect(container.querySelector("[data-mode='recovery']")).toHaveClass("recovery-mode");
    expect(screen.getByText("Recovery mode")).toBeInTheDocument();
    for (const title of ["Must do now", "Can simplify", "Blocked / needs someone else", "Can follow up later"]) {
      expect(screen.getByRole("heading", { level: 2, name: new RegExp(title.replace("/", "\\/")) })).toBeInTheDocument();
    }
    expect(screen.getByRole("link", { name: /Leave recovery/ })).toHaveAttribute("href", `/o/${RESCUE_ACTIVITY_ID}`);

    const fallbacks = screen.getAllByRole("button", { name: "Use fallback" });
    await user.click(fallbacks[0]);
    expect(store().getActivity(RESCUE_ACTIVITY_ID)!.actions.some((action) => action.fallbackUsed)).toBe(true);
  });

  it("persists changes in the existing v2 demo storage", async () => {
    const user = userEvent.setup();
    renderApp(<OccurrenceView id={RESCUE_ACTIVITY_ID} />, { path: `/o/${RESCUE_ACTIVITY_ID}` });
    await screen.findByRole("heading", { level: 1, name: "Leading through change" });
    await user.click(screen.getByRole("button", { name: "Mark Confirm participant list done" }));
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(stored.version).toBe(2);
    expect(stored.modified).toBe(true);
    const rescue = stored.activities.find((activity: { id: string }) => activity.id === RESCUE_ACTIVITY_ID);
    expect(rescue.actions.find((action: { id: string }) => action.id === "participants-confirmed").status).toBe("done");
  });
});

describe("Designed empty and not-found states", () => {
  it("shows a not-found-in-this-demo state for an unknown occurrence ID", async () => {
    renderApp(<OccurrenceView id="does-not-exist" />, { path: "/o/does-not-exist" });
    expect(await screen.findByRole("heading", { name: "Not found in this demo" })).toBeInTheDocument();
    expect(screen.getByText("does-not-exist")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute("href", "/");
  });

  it("shows the same state inside recovery mode for an unknown ID", async () => {
    const { container } = renderApp(<RecoveryView id="missing" />, { path: "/o/missing/recovery" });
    expect(await screen.findByRole("heading", { name: "Not found in this demo" })).toBeInTheDocument();
    expect(container.querySelector(".recovery-mode")).toBeInTheDocument();
  });

  it.each([
    ["calendar", "M7"],
    ["portfolio", "M6"],
    ["people", "M9"],
  ] as const)("shows an honest coming-soon state for %s (%s) without sample data", (section, milestone) => {
    render(<ComingSoonView section={section} />);
    expect(screen.getAllByText(`Coming in ${milestone}`).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { level: 2, name: /is not built yet/ })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});

describe("Themes", () => {
  it("cycles the workspace theme between system, light and dark and stores the choice", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const root = document.documentElement;
    expect(root.dataset.theme).toBeUndefined();

    await user.click(screen.getByRole("button", { name: /System theme/ }));
    expect(root.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    await user.click(screen.getByRole("button", { name: /Light theme/ }));
    expect(root.dataset.theme).toBe("dark");

    await user.click(screen.getByRole("button", { name: /Dark theme/ }));
    expect(root.dataset.theme).toBeUndefined();
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

  function block(selector: string) {
    const start = css.indexOf(`${selector} {`);
    expect(start, `${selector} block`).toBeGreaterThanOrEqual(0);
    return css.slice(start, css.indexOf("}", start));
  }

  it("uses the 8.2 workspace tokens for light and a dark variant for system or explicit dark", () => {
    const light = block(":root");
    for (const token of ["--surface-page: #F6F7F9", "--surface-panel: #FFFFFF", "--ink: #18212C", "--accent: #2457C5", "--state-risk: #B2401F"]) {
      expect(light).toContain(token);
    }
    expect(css).toMatch(/@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-theme="light"\]\)/);
    const dark = block(':root[data-theme="dark"]');
    for (const token of ["--surface-page: #12161C", "--surface-panel: #191E26", "--ink: #E6EAF0", "--accent: #7EA6FF", "--state-risk: #FF8A68"]) {
      expect(dark).toContain(token);
    }
  });

  it("keeps recovery mode always dark, independent of the workspace theme", () => {
    const recovery = block(".recovery-mode");
    expect(recovery).toContain("color-scheme: dark");
    expect(recovery).toContain("background: var(--rc-page)");
    expect(block(":root")).toContain("--rc-page: #0D1117");
    expect(css).not.toMatch(/\[data-theme="light"\][^{]*\.recovery-mode/);
  });

  it("follows the visual exclusions: no Inter, no teal accent, no warm cream, no oversized radii", () => {
    expect(css).not.toMatch(/\bInter\b/);
    expect(css.toLowerCase()).not.toMatch(/#376d68|#f5f4f0|#d8e7e2/);
    const radii = [...css.matchAll(/border-radius:\s*(\d+)px/g)].map((match) => Number(match[1]));
    expect(radii.every((value) => value <= 8)).toBe(true);
    expect(css).not.toMatch(/\.sidebar\b/);
  });
});
