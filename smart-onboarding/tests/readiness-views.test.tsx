import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InsightsView } from "@/components/insights/insights-view";
import { CaseDetailView } from "@/components/onboarding/case-detail-view";
import { ReadinessView } from "@/components/readiness/readiness-view";
import { ToastProvider } from "@/components/ui/toast";
import { onboardingStore } from "@/lib/onboarding-store";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

beforeEach(() => {
  window.localStorage.clear();
  onboardingStore._resetForTests();
});

describe("ReadinessView", () => {
  it("lists active cases with their readiness and filters by status", async () => {
    const user = userEvent.setup();
    render(<ReadinessView initialStatus="At risk" />);
    const list = screen.getByRole("list", { name: "Readiness by case" });
    expect(list.children).toHaveLength(2);
    expect(within(list).getByRole("link", { name: "Tomás Herrera" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /^All/ }));
    expect(list.children).toHaveLength(8);
  });

  it("shows blocked downstream tasks across cases", () => {
    render(<ReadinessView />);
    const downstream = screen.getByRole("region", { name: "Blocked downstream tasks" });
    const chain = within(downstream).getByRole("list", { name: "Held up by Prepare laptop and equipment" });
    expect(within(chain).getByText("Confirm equipment and system access")).toBeInTheDocument();
  });
});

describe("CaseDetailView", () => {
  it("explains the readiness status with rules, reasons and dependencies", () => {
    render(
      <ToastProvider>
        <CaseDetailView id="demo-maya-lindqvist" />
      </ToastProvider>,
    );
    const panel = screen.getByRole("region", { name: "Not ready" });
    expect(within(panel).getByText(/Laptop model on back-order/)).toBeInTheDocument();
    expect(panel).toHaveTextContent("Failed: No mandatory task is blocked");
    expect(panel).toHaveTextContent("Passed: No mandatory task is overdue");

    const task = document.getElementById("task-demo-maya-lindqvist--confirm-access")!;
    expect(within(task).getByText(/Held up by “Prepare laptop and equipment”/)).toBeInTheDocument();
    expect(within(task).getByText("Depends on")).toBeInTheDocument();
    expect(within(task).getByText("Mandatory")).toBeInTheDocument();
  });

  it("updates readiness when the blocker is resolved", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <CaseDetailView id="demo-maya-lindqvist" />
      </ToastProvider>,
    );
    const equipment = document.getElementById("task-demo-maya-lindqvist--equipment")!;
    await user.selectOptions(within(equipment).getByRole("combobox", { name: /Status for/ }), "Completed");
    // Blocker gone: tasks due within 7 days remain, so the case is now At risk.
    expect(screen.getByRole("region", { name: "At risk" })).toBeInTheDocument();
  });
});

describe("InsightsView", () => {
  it("renders KPIs calculated from the synthetic data with definitions", () => {
    render(<InsightsView />);
    expect(screen.getByText(/Illustrative insights from synthetic demo data/)).toBeInTheDocument();
    const day1 = screen.getByRole("group", { name: "Day 1 readiness rate" });
    expect(within(day1).getByText("67%")).toBeInTheDocument();
    expect(within(day1).getByText("4 of 6 started cases were fully ready on Day 1")).toBeInTheDocument();
    expect(within(screen.getByRole("group", { name: "Recurring blockers" })).getByText("2")).toBeInTheDocument();
    expect(screen.getAllByText("Definition:").length).toBeGreaterThanOrEqual(6);
  });

  it("offers a table view for each chart", async () => {
    const user = userEvent.setup();
    render(<InsightsView />);
    const stage = screen.getByRole("region", { name: "Completion by stage" });
    await user.click(within(stage).getByRole("button", { name: "Show table" }));
    expect(within(stage).getByRole("table")).toBeInTheDocument();
    expect(within(stage).getByRole("rowheader", { name: "Pre-boarding" })).toBeInTheDocument();
  });
});
