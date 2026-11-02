import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { HomeView } from "@/components/home-view";
import { CaseDetailView } from "@/components/onboarding/case-detail-view";
import { PortalJourneyView } from "@/components/portal/portal-journey-view";
import { ToastProvider } from "@/components/ui/toast";
import { demoModeStore } from "@/lib/demo-mode";
import { onboardingStore } from "@/lib/onboarding-store";

const nav = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: nav.push }),
  usePathname: () => nav.pathname,
}));

function renderAt(pathname: string, page: React.ReactNode) {
  nav.pathname = pathname;
  return render(<AppShell>{page}</AppShell>);
}

const danielTask = (key: string) =>
  onboardingStore
    .getSnapshot()
    .find((c) => c.id === "demo-daniel-okafor")!
    .tasks.find((t) => t.templateKey === key)!;

beforeEach(() => {
  window.localStorage.clear();
  onboardingStore._resetForTests();
  demoModeStore._resetForTests();
  nav.push.mockReset();
});

describe("Employee portal home", () => {
  it("is the default experience and welcomes the new hire personally", () => {
    renderAt("/", <HomeView />);
    expect(screen.getByRole("heading", { level: 1, name: "Good to see you, Daniel" })).toBeInTheDocument();
    expect(screen.getByText("You are in week 2 of your first 90 days.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Onboarding steps done: 63%" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Your onboarding journey" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Your first month.*You are here/ })).toHaveAttribute("aria-current", "step");

    const people = screen.getByRole("region", { name: "Your people" });
    for (const name of ["Priya Raman", "Amara Osei", "Mei Lin"]) {
      expect(within(people).getByText(name)).toBeInTheDocument();
    }
    expect(screen.getByRole("region", { name: "Your schedule" })).toHaveTextContent("First-month conversation");
    expect(screen.getByRole("region", { name: "About your information" })).toHaveTextContent(
      "no sign-in, no real access control",
    );
  });

  it("labels the previews as simulated and offers both Demo Mode options", () => {
    renderAt("/", <HomeView />);
    expect(screen.getByText(/Previews are simulated: there is no sign-in and no real access control/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Preview as New Hire" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Preview as HR" })).not.toBeChecked();
    const mainNav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(mainNav).getByRole("link", { name: "My journey" })).toBeInTheDocument();
    expect(within(mainNav).queryByRole("link", { name: "Process insights" })).not.toBeInTheDocument();
  });

  it("shows other stakeholders' steps read-only, without internal blocker notes", async () => {
    const user = userEvent.setup();
    renderAt("/", <HomeView />);
    await user.selectOptions(screen.getByLabelText("Viewing as"), "demo-maya-lindqvist");

    expect(screen.getByRole("heading", { level: 1, name: "Welcome aboard, Maya" })).toBeInTheDocument();
    const week = screen.getByRole("region", { name: "This week" });
    expect(within(week).getByText("IT prepares your laptop and equipment")).toBeInTheDocument();
    expect(within(week).getByText("Delayed: HR is following up")).toBeInTheDocument();
    expect(within(week).queryByRole("button", { name: /IT prepares your laptop/ })).not.toBeInTheDocument();
    expect(within(week).getAllByText(/Read-only, handled by IT/).length).toBeGreaterThan(0);
    expect(document.body).not.toHaveTextContent(/back-order/i);

    expect(within(week).getByRole("button", { name: "Mark “Complete your new-hire forms” as done" })).toBeInTheDocument();
  });

  it("lets the new hire complete their own step, which HR then sees", async () => {
    const user = userEvent.setup();
    renderAt("/", <HomeView />);
    await user.selectOptions(screen.getByLabelText("Viewing as"), "demo-maya-lindqvist");
    await user.click(screen.getByRole("button", { name: "Mark “Complete your new-hire forms” as done" }));

    const task = onboardingStore
      .getSnapshot()
      .find((c) => c.id === "demo-maya-lindqvist")!
      .tasks.find((t) => t.templateKey === "new-hire-forms")!;
    expect(task.status).toBe("Completed");
    expect(screen.getByRole("status")).toHaveTextContent("“Complete your new-hire forms” is done");
    expect(screen.getByText("Nothing for you to do this week")).toBeInTheDocument();
  });
});

describe("Employee journey page", () => {
  it("lists every phase and lets the employee filter to their own steps", async () => {
    const user = userEvent.setup();
    renderAt("/me/journey", <PortalJourneyView />);
    expect(screen.getByRole("heading", { level: 1, name: "Your onboarding journey" })).toBeInTheDocument();
    for (const phase of ["Before you start", "Your first day", "Your first month", "Building momentum", "Your 90-day review"]) {
      expect(screen.getByRole("region", { name: phase })).toBeInTheDocument();
    }
    const firstDay = screen.getByRole("region", { name: "Your first day" });
    expect(within(firstDay).getByText("Check your equipment and logins work")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Just mine" }));
    expect(within(firstDay).queryByText("Check your equipment and logins work")).not.toBeInTheDocument();
    expect(within(firstDay).getByText("No steps for you in this phase.")).toBeInTheDocument();
    const month = screen.getByRole("region", { name: "Your first month" });
    expect(within(month).getByText("Share feedback on your onboarding (optional)")).toBeInTheDocument();
  });

  it("allows completing and undoing the employee's own steps only", async () => {
    const user = userEvent.setup();
    renderAt("/me/journey", <PortalJourneyView />);
    const done = screen.getByRole("button", { name: "Undo “Complete your new-hire forms”" });
    expect(done).toBeInTheDocument();
    // 2 own steps, so exactly one "Mark as done" and one "Undo"; nothing else is editable.
    expect(screen.getAllByRole("button", { name: /^Mark “/ })).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Mark “Share feedback on your onboarding (optional)” as done" }));
    expect(danielTask("experience-survey").status).toBe("Completed");
    await user.click(screen.getByRole("button", { name: "Undo “Share feedback on your onboarding (optional)”" }));
    expect(danielTask("experience-survey").status).toBe("Not started");
    expect(danielTask("confirm-access").status).toBe("In progress");
  });
});

describe("Demo Mode switch", () => {
  it("switches to the HR workspace and back", async () => {
    const user = userEvent.setup();
    renderAt("/", <HomeView />);
    await user.click(screen.getByRole("radio", { name: "Preview as HR" }));

    expect(nav.push).toHaveBeenCalledWith("/");
    expect(screen.getByRole("heading", { level: 1, name: "Onboarding readiness" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Viewing as")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("simulated view, not a sign-in");
    const mainNav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(mainNav).getByRole("link", { name: "Process insights" })).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Preview as New Hire" }));
    expect(screen.getByRole("heading", { level: 1, name: "Good to see you, Daniel" })).toBeInTheDocument();
  });

  it("shows a notice instead of HR pages in the New Hire preview", async () => {
    const user = userEvent.setup();
    renderAt("/insights", <p>HR insights content</p>);
    expect(screen.getByRole("heading", { name: "This page is part of the HR workspace" })).toBeInTheDocument();
    expect(screen.queryByText("HR insights content")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch to Preview as HR" }));
    expect(screen.getByText("HR insights content")).toBeInTheDocument();
  });

  it("shows a notice instead of portal pages in the HR preview", () => {
    demoModeStore.setRole("hr");
    renderAt("/me/journey", <p>Portal content</p>);
    expect(screen.getByRole("heading", { name: "This page is part of the new-hire portal" })).toBeInTheDocument();
    expect(screen.queryByText("Portal content")).not.toBeInTheDocument();
  });
});

describe("Shared case between HR and the portal", () => {
  it("lets HR open the portal preview for a case and shows its support contacts", async () => {
    const user = userEvent.setup();
    demoModeStore.setRole("hr");
    render(
      <ToastProvider>
        <CaseDetailView id="demo-sofia-marin" />
      </ToastProvider>,
    );
    expect(screen.getByText("Jonah Whitaker")).toBeInTheDocument();
    expect(screen.getByText("Lucía Romero")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Preview portal as Sofia" }));
    expect(demoModeStore.getSnapshot()).toEqual({ role: "new-hire", caseId: "demo-sofia-marin" });
    expect(nav.push).toHaveBeenCalledWith("/");
  });
});
