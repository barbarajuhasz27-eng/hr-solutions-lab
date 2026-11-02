import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NewOnboardingForm } from "@/components/onboarding/new-onboarding-form";
import { ToastProvider } from "@/components/ui/toast";
import { onboardingStore } from "@/lib/onboarding-store";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/onboarding/new",
}));

function renderForm() {
  return render(
    <ToastProvider>
      <NewOnboardingForm />
    </ToastProvider>,
  );
}

describe("NewOnboardingForm", () => {
  beforeEach(() => {
    push.mockReset();
    window.localStorage.clear();
    onboardingStore._resetForTests();
  });

  it("shows accessible validation errors and does not create a case when empty", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.click(screen.getByRole("button", { name: "Create onboarding case" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Please fix 6 fields");
    const name = screen.getByLabelText(/Employee name/);
    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(name).toHaveAccessibleDescription("Employee name is required.");
    expect(name).toHaveFocus();
    expect(push).not.toHaveBeenCalled();
    expect(onboardingStore.getSnapshot()).toHaveLength(10);
  });

  it("creates a case with the adaptive workflow for its context and navigates to it", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText(/Employee name/), "Robin Vale");
    await user.type(screen.getByLabelText(/Job title/), "Recruiter");
    await user.type(screen.getByLabelText(/Department/), "People");
    await user.type(screen.getByLabelText(/Hiring manager/), "Kim Hale");
    await user.type(screen.getByLabelText(/Location/), "Remote");
    await user.type(screen.getByLabelText(/Start date/), "2027-01-04");
    await user.selectOptions(screen.getByLabelText(/Employment type/), "Part-time");
    await user.click(screen.getByRole("radio", { name: /Remote employee/ }));
    await user.click(screen.getByRole("checkbox", { name: /International hire/ }));
    await user.click(screen.getByRole("button", { name: "Create onboarding case" }));

    const cases = onboardingStore.getSnapshot();
    expect(cases).toHaveLength(11);
    const created = cases[0];
    expect(created).toMatchObject({
      employeeName: "Robin Vale",
      employmentType: "Part-time",
      startDate: "2027-01-04",
    });
    expect(created.workflow).toEqual({ workArrangement: "Remote", peopleManager: false, internationalHire: true });
    expect(created.tasks).toHaveLength(22);
    expect(created.tasks.some((t) => t.templateKey === "intl-hr-review")).toBe(true);
    expect(created.tasks.some((t) => t.templateKey === "desk-access")).toBe(false);
    expect(push).toHaveBeenCalledWith(`/onboarding/${created.id}`);
    expect(screen.getByRole("status")).toHaveTextContent("Onboarding case created for Robin Vale");
  });

  it("previews due dates once a start date is chosen", async () => {
    const user = userEvent.setup();
    renderForm();
    expect(screen.getByText("Choose a start date to preview due dates.")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Start date/), "2027-01-04");
    expect(screen.queryByText("Choose a start date to preview due dates.")).not.toBeInTheDocument();
    expect(screen.getByText("25 Dec")).toBeInTheDocument(); // -10 days
  });
});

describe("NewOnboardingForm workflow preview", () => {
  beforeEach(() => {
    window.localStorage.clear();
    onboardingStore._resetForTests();
  });

  it("updates the generated workflow when the context changes", async () => {
    const user = userEvent.setup();
    renderForm();
    const preview = screen.getByRole("region", { name: "Generated workflow" });
    expect(preview).toHaveTextContent("18 tasks (15 mandatory) from 2 modules");
    expect(preview).not.toHaveTextContent("Hold first 1:1s with direct reports");

    await user.click(screen.getByRole("checkbox", { name: /People manager/ }));
    expect(preview).toHaveTextContent("22 tasks (18 mandatory) from 3 modules");
    expect(preview).toHaveTextContent("Hold first 1:1s with direct reports");
  });
});
