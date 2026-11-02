import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { onboardingStore } from "@/lib/onboarding-store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

function metricValue(label: string) {
  const card = screen.getByRole("group", { name: label });
  return within(card).getByText(/^\d+%?$/).textContent;
}

function readinessCount(status: string) {
  const region = screen.getByRole("region", { name: "Readiness for the next milestone" });
  const link = within(region).getByRole("link", { name: new RegExp(`^[0-9]+ ${status}:`) });
  return link.getAttribute("aria-label")!.split(" ")[0];
}

describe("DashboardView", () => {
  beforeEach(() => {
    window.localStorage.clear();
    onboardingStore._resetForTests();
  });

  it("leads with readiness and renders metrics derived from the demo data", () => {
    render(<DashboardView />);
    expect(readinessCount("Not ready")).toBe("3");
    expect(readinessCount("At risk")).toBe("2");
    expect(readinessCount("On track")).toBe("2");
    expect(readinessCount("Ready")).toBe("1");

    expect(metricValue("Upcoming starts")).toBe("4");
    expect(metricValue("Active onboardings")).toBe("8");
    expect(metricValue("Tasks overdue")).toBe("5");
    expect(metricValue("Overall task completion")).toBe("53%");

    const critical = screen.getByRole("region", { name: "Critical outstanding tasks" });
    expect(within(critical).getByText("Prepare laptop and equipment")).toBeInTheDocument();
    expect(within(critical).getByText(/Held up by “Prepare laptop and equipment”/)).toBeInTheDocument();
  });

  it("updates readiness and metrics when a critical task is completed", async () => {
    const user = userEvent.setup();
    render(<DashboardView />);

    const critical = screen.getByRole("region", { name: "Critical outstanding tasks" });
    const danielItem = within(critical)
      .getAllByRole("listitem")
      .find((li) => within(li).queryByRole("link", { name: "Daniel Okafor" }))!;
    await user.selectOptions(within(danielItem).getByRole("combobox"), "Completed");

    expect(metricValue("Tasks overdue")).toBe("4");
    expect(readinessCount("Not ready")).toBe("2");
    expect(readinessCount("On track")).toBe("3");
    expect(within(critical).queryByRole("link", { name: "Daniel Okafor" })).not.toBeInTheDocument();
  });

  it("shows readiness per case and filters the cases table by search query", async () => {
    const user = userEvent.setup();
    render(<DashboardView />);
    const table = screen.getByRole("region", { name: "Onboarding cases" });
    expect(within(table).getByRole("columnheader", { name: "Readiness" })).toBeInTheDocument();
    await user.type(within(table).getByRole("searchbox"), "customer success");
    expect(within(table).getAllByRole("link", { name: "Sofia Marin" }).length).toBeGreaterThan(0);
    expect(within(table).queryByRole("link", { name: "Maya Lindqvist" })).not.toBeInTheDocument();
  });
});
