import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { ExperienceView } from "@/components/experience/experience-view";
import { InsightsView } from "@/components/insights/insights-view";
import { ReadinessView } from "@/components/readiness/readiness-view";
import { ToastProvider } from "@/components/ui/toast";
import { demoModeStore } from "@/lib/demo-mode";
import { ANALYTICS_DISCLAIMER } from "@/lib/experience";
import { onboardingStore } from "@/lib/onboarding-store";

const nav = vi.hoisted(() => ({ pathname: "/experience", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
}));

function renderAt(pathname: string, page: React.ReactNode) {
  nav.pathname = pathname;
  return render(
    <ToastProvider>
      <AppShell>{page}</AppShell>
    </ToastProvider>,
  );
}

const DANIEL = "demo-daniel-okafor";
const allFours = { "role-clarity": 4, "learning-development": 4, "manager-support": 4, "team-integration": 4, "tools-resources": 4 };
const SOFIA_COMMENT = "Getting access to the reporting workspace took longer than I expected.";
const SOFIA_HR_NOTE = "Check whether other Finance starters had the same access delay.";
const LENA_COMMENT = "Our 1:1s keep moving and I am not sure what to prioritise.";
const region = (name: string) => screen.getByRole("region", { name });

beforeEach(() => {
  window.localStorage.clear();
  onboardingStore._resetForTests();
  demoModeStore._resetForTests();
  demoModeStore.setRole("hr");
});

describe("Experience & Process Intelligence page", () => {
  it("has the five sections, each with the synthetic-data notice, and is in the HR navigation", () => {
    renderAt("/experience", <ExperienceView />);
    expect(screen.getByRole("heading", { level: 1, name: "Experience & Process Intelligence" })).toBeInTheDocument();
    for (const name of ["Executive overview", "Employee experience", "Learning & development", "Check-ins & actions", "Process bottlenecks"]) {
      expect(within(region(name)).getAllByText(ANALYTICS_DISCLAIMER).length).toBeGreaterThan(0);
    }
    const mainNav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(mainNav).getByRole("link", { name: "Experience" })).toHaveAttribute("href", "/experience");
  });

  it("shows the six headline figures from the demo data with their definitions", () => {
    renderAt("/experience", <ExperienceView />);
    const exec = region("Executive overview");
    const value = (label: string) => within(within(exec).getByRole("group", { name: label })).getByText(/^(\d+%?|No data)$/).textContent;
    expect(value("Onboarding readiness")).toBe("38%");
    expect(value("Mandatory learning completion")).toBe("88%");
    expect(value("Check-in completion")).toBe("100%");
    expect(value("Feedback participation")).toBe("86%");
    expect(value("Action closure rate")).toBe("33%");
    expect(value("Overdue actions")).toBe("1");
    expect(exec).toHaveTextContent("Upcoming check-ins are excluded from the denominator.");
    expect(exec).toHaveTextContent("Open, in-progress and reopened actions do not count as completed.");
  });

  it("shows the seeded Day 7 group and hides smaller groups without values or counts", () => {
    renderAt("/experience", <ExperienceView />);
    const exp = region("Employee experience");
    expect(exp).toHaveTextContent("Synthetic ratings from fictional employees.");
    const trends = within(exp).getByRole("table", { name: /Average rating by experience area and checkpoint/ });
    const roleRow = within(trends).getByRole("row", { name: /Role clarity/ });
    expect(roleRow).toHaveTextContent("3.6");
    expect(within(roleRow).getAllByText("Not shown")).toHaveLength(3);
    expect(within(trends).getAllByText("Not shown")).toHaveLength(15);
    expect(within(trends).getAllByText("Fewer than 5")).toHaveLength(3);
    expect(within(trends).getByRole("row", { name: /Employees in group/ })).toHaveTextContent("5");
    expect(within(exp).getByRole("note", { name: "Groups not shown" })).toHaveTextContent(
      "Not shown: Day 30, Day 60, Day 90. Fewer than 5 different employees have answered these surveys",
    );
    // Only Day 7 has numbers: five averages, one per area.
    expect(within(trends).getAllByText(/^\d\.\d$/)).toHaveLength(5);
    expect(within(trends).getAllByText(/^4\.0$/)).toHaveLength(1);
    // The area chart shows aggregated averages only.
    const areas = within(exp).getByRole("list", { name: /Average rating by experience area/ });
    expect(within(areas).getByRole("listitem", { name: /Tools and resources: 3\.4\. 5 employees/ })).toBeInTheDocument();
  });

  it("offers no filters or drill-downs that could narrow the population", () => {
    renderAt("/experience", <ExperienceView />);
    const main = screen.getByRole("main");
    expect(within(main).queryAllByRole("combobox")).toHaveLength(0);
    expect(within(main).queryAllByRole("searchbox")).toHaveLength(0);
    expect(within(main).queryAllByRole("textbox")).toHaveLength(0);
    expect(within(main).queryAllByRole("checkbox")).toHaveLength(0);
    expect(within(main).queryAllByRole("radio")).toHaveLength(0);
    // Nothing in the experience section links to an individual case.
    const exp = region("Employee experience");
    for (const link of within(exp).queryAllByRole("link")) expect(link.getAttribute("href")).not.toMatch(/onboarding\//);
  });

  it("updates the Day 7 group and area averages when the demo employee answers, and still hides the rest", async () => {
    expect(onboardingStore.submitSurvey({ role: "new-hire", caseId: DANIEL }, DANIEL, "day-7", allFours, "")).toBe("submitted");
    renderAt("/experience", <ExperienceView />);
    const exp = region("Employee experience");
    const trends = within(exp).getByRole("table", { name: /Average rating by experience area and checkpoint/ });
    const roleRow = within(trends).getByRole("row", { name: /Role clarity/ });
    expect(roleRow).toHaveTextContent("3.7");
    expect(within(roleRow).getAllByText("Not shown")).toHaveLength(3);
    expect(within(trends).getAllByText("Not shown")).toHaveLength(15);

    const areas = within(exp).getByRole("list", { name: /Average rating by experience area/ });
    expect(within(areas).getByRole("listitem", { name: /Tools and resources: 3\.5\. 6 employees/ })).toBeInTheDocument();

    // The table view of the area chart shows the same aggregated values only.
    const user = userEvent.setup();
    const areaCard = within(exp).getByRole("region", { name: "Average rating by experience area" });
    await user.click(within(areaCard).getByRole("button", { name: "Show table" }));
    expect(within(areaCard).getByRole("table")).toHaveTextContent("Tools and resources3.56 employees");
  });

  it("never shows comments, individual ratings or HR-only notes", async () => {
    expect(onboardingStore.submitSurvey({ role: "new-hire", caseId: DANIEL }, DANIEL, "day-7", allFours, "My private Day 7 note")).toBe("submitted");
    renderAt("/experience", <ExperienceView />);
    const main = screen.getByRole("main");
    for (const text of [SOFIA_COMMENT, SOFIA_HR_NOTE, LENA_COMMENT, "My private Day 7 note"]) expect(main).not.toHaveTextContent(text);
    const exp = region("Employee experience");
    for (const name of ["Sofia Marin", "Lena Fischer", "Marcus", "Inês Duarte", "Daniel Okafor", "Rafael Costa"]) expect(exp).not.toHaveTextContent(name);
    for (const tip of within(main).queryAllByRole("tooltip")) {
      expect(tip).not.toHaveTextContent(/Sofia|Lena|Marcus|Inês|Daniel|Rafael/);
    }
  });

  it("explains each bottleneck with a definition and without causal claims", () => {
    renderAt("/experience", <ExperienceView />);
    const b = region("Process bottlenecks");
    for (const name of ["Overdue onboarding tasks by owner", "Overdue mandatory learning by module", "Check-ins due but not yet booked", "Recurring unresolved actions", "Delays across onboarding stages"]) {
      const card = within(b).getByRole("region", { name });
      expect(card).toHaveTextContent("Definition:");
      expect(card).toHaveTextContent(ANALYTICS_DISCLAIMER);
    }
    expect(within(b).getByRole("region", { name: "Check-ins due but not yet booked" })).toHaveTextContent("Inês DuarteShared topic, no check-in scheduled");
    expect(within(b).getByRole("region", { name: "Recurring unresolved actions" })).toHaveTextContent("Set up a fixed fortnightly 1:1 · reopened 1×");
    expect(b).toHaveTextContent("They do not establish causes");
    expect(b).not.toHaveTextContent(/\b(caused by|because of|leads to|results in|saves|retention)\b/i);
  });

  it("is HR only in the simulated preview", () => {
    demoModeStore.setRole("new-hire");
    renderAt("/experience", <ExperienceView />);
    expect(screen.getByRole("heading", { name: "This page is part of the HR workspace" })).toBeInTheDocument();
    expect(screen.queryByText(ANALYTICS_DISCLAIMER)).toBeNull();
  });
});

describe("Empty states", () => {
  it("shows no-data states instead of NaN when the workspace is empty", () => {
    for (const c of onboardingStore.getSnapshot()) onboardingStore.deleteCase(c.id);
    renderAt("/experience", <ExperienceView />);
    const main = screen.getByRole("main");
    expect(main).not.toHaveTextContent(/NaN|Infinity|undefined/);
    const exec = region("Executive overview");
    expect(within(within(exec).getByRole("group", { name: "Check-in completion" })).getByText("No data")).toBeInTheDocument();
    expect(within(exec).getByRole("group", { name: "Feedback participation" })).toHaveTextContent("No surveys eligible yet");
    expect(main).toHaveTextContent("No overdue onboarding tasks.");
    expect(main).toHaveTextContent("No surveys are eligible yet.");
    expect(main).toHaveTextContent("No mandatory learning is due yet.");
    expect(main).toHaveTextContent("Not enough responses to show yet");
    expect(screen.getByRole("note", { name: "Groups not shown" })).toHaveTextContent("No checkpoint can be shown yet");
  });
});

describe("Integration with the HR pages", () => {
  it("adds experience tiles on the dashboard that link to the report", () => {
    nav.pathname = "/";
    render(<DashboardView />);
    const tiles = region("Experience & process intelligence");
    expect(within(tiles).getByRole("link", { name: /^Mandatory learning completion: 88%/ })).toHaveAttribute("href", "/experience");
    expect(within(tiles).getByRole("link", { name: /^Feedback participation: 86%/ })).toHaveAttribute("href", "/experience");
    expect(within(tiles).getByRole("link", { name: /^Overdue actions: 1/ })).toHaveAttribute("href", "/experience");
    expect(tiles).toHaveTextContent(ANALYTICS_DISCLAIMER);
  });

  it("adds an Experience & Process Intelligence section to insights and readiness without ratings", () => {
    nav.pathname = "/insights";
    const { unmount } = render(<InsightsView />);
    const insights = screen.getByRole("region", { name: "Experience & Process Intelligence" });
    expect(insights).toHaveTextContent("Recurring unresolved actions1");
    expect(insights).toHaveTextContent(ANALYTICS_DISCLAIMER);
    expect(within(insights).getByRole("link", { name: /Open Experience & Process Intelligence/ })).toHaveAttribute("href", "/experience");
    unmount();

    nav.pathname = "/readiness";
    render(<ReadinessView />);
    const readiness = screen.getByRole("region", { name: "Experience & Process Intelligence" });
    expect(readiness).toHaveTextContent("do not change any readiness status");
    expect(readiness).toHaveTextContent("Mandatory learning overdue2");
    expect(readiness).toHaveTextContent("Check-ins due but not booked1");
    expect(readiness).not.toHaveTextContent(/\d\.\d/);
  });
});
