import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { HomeView } from "@/components/home-view";
import { HrLearningView } from "@/components/learning/hr-learning-view";
import { LearningCatalogView } from "@/components/learning/learning-catalog-view";
import { ModuleView } from "@/components/learning/module-view";
import { CaseDetailView } from "@/components/onboarding/case-detail-view";
import { ToastProvider } from "@/components/ui/toast";
import { demoModeStore } from "@/lib/demo-mode";
import { assignmentId } from "@/lib/learning";
import { getModule } from "@/lib/learning-catalog";
import { onboardingStore } from "@/lib/onboarding-store";
import type { Quiz } from "@/types/learning";

const nav = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
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

const DISCLAIMER = /Illustrative content — not certified compliance training/;

async function answerQuiz(user: ReturnType<typeof userEvent.setup>, quiz: Quiz, correct: boolean) {
  for (const q of quiz.questions) {
    const option = q.options.find((o) => (o.id === q.correctOptionId) === correct)!;
    await user.click(screen.getByRole("radio", { name: option.text }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(q.explanation)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Next question|See your result/ }));
  }
}

beforeEach(() => {
  window.localStorage.clear();
  onboardingStore._resetForTests();
  demoModeStore._resetForTests();
  nav.push.mockReset();
});

describe("Learning Center (new hire)", () => {
  it("groups Daniel's modules by checkpoint with status, requirement and due date", () => {
    renderAt("/me/learning", <LearningCatalogView />);
    expect(screen.getByRole("heading", { level: 1, name: "Learning Center" })).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByText("1 of 4 done")).toBeInTheDocument();

    const day7 = screen.getByRole("region", { name: "By Day 7" });
    const hs = within(day7).getByRole("link", { name: /Workplace Health & Safety/ });
    expect(hs).toHaveAttribute("href", "/me/learning/health-safety");
    expect(hs).toHaveTextContent("Overdue");
    expect(hs).toHaveTextContent("Mandatory");
    expect(hs).toHaveTextContent("1 days overdue");
    expect(within(day7).getByRole("link", { name: /Company Culture & Values/ })).toHaveTextContent("Completed");

    const day30 = screen.getByRole("region", { name: "By Day 30" });
    expect(within(day30).getByRole("link", { name: /Remote Working Essentials/ })).toHaveTextContent("Not started");
    expect(screen.getByRole("region", { name: "By Day 60" })).toHaveTextContent("No modules at this checkpoint.");

    // The manager module is shown as information only, not as an assignment.
    const others = screen.getByRole("region", { name: "Also in the catalog" });
    expect(others).toHaveTextContent("Leading Your New Team");
    expect(within(others).queryByRole("link")).toBeNull();
  });

  it("adds Learning to the portal navigation and a learning card to the portal home", () => {
    renderAt("/", <HomeView />);
    const mainNav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(mainNav).getByRole("link", { name: "Learning" })).toHaveAttribute("href", "/me/learning");
    const card = screen.getByRole("region", { name: "Your learning" });
    expect(card).toHaveTextContent("1 of 4 mandatory modules done");
    expect(within(card).getByRole("link", { name: "Workplace Health & Safety" })).toBeInTheDocument();
  });
});

describe("Module viewer", () => {
  const hs = getModule("health-safety");

  it("opens on the first unread lesson, unlocks the quiz and completes on a pass", async () => {
    const user = userEvent.setup();
    renderAt("/me/learning/health-safety", <ModuleView moduleId="health-safety" />);
    expect(screen.getByRole("heading", { level: 1, name: hs.title })).toBeInTheDocument();
    expect(screen.getByText(DISCLAIMER)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: hs.lessons[2].title })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Mark as read and continue" }));
    expect(screen.getByText(/Pass mark:/)).toHaveTextContent(`${hs.quiz!.passMark}%`);
    await user.click(screen.getByRole("button", { name: "Start quiz" }));
    expect(screen.getByText(`Question 1 of ${hs.quiz!.questions.length}`)).toBeInTheDocument();

    await answerQuiz(user, hs.quiz!, true);
    expect(screen.getByRole("heading", { name: "Quiz passed" })).toBeInTheDocument();
    expect(screen.getByText(/Module completed on/)).toBeInTheDocument();
    const saved = onboardingStore.getLearningSnapshot().find((a) => a.id === assignmentId("demo-daniel-okafor", "health-safety"))!;
    expect(saved.completedAt).toBeDefined();
    expect(saved.quizResults).toHaveLength(1);
  });

  it("shows the result against the pass mark and allows a retry after failing", async () => {
    const user = userEvent.setup();
    renderAt("/me/learning/health-safety", <ModuleView moduleId="health-safety" />);
    await user.click(screen.getByRole("button", { name: "Mark as read and continue" }));
    await user.click(screen.getByRole("button", { name: "Start quiz" }));
    await answerQuiz(user, hs.quiz!, false);

    expect(screen.getByRole("heading", { name: "Not passed yet" })).toBeInTheDocument();
    expect(screen.getByText(/The pass mark is 75%/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry quiz" }));
    expect(screen.getByText(`Question 1 of ${hs.quiz!.questions.length}`)).toBeInTheDocument();
  });

  it("keeps the quiz locked until every lesson has been read", async () => {
    const user = userEvent.setup();
    renderAt("/me/learning/data-protection", <ModuleView moduleId="data-protection" />);
    await user.click(screen.getByRole("button", { name: /^Quiz\s*Opens after the lessons$/ }));
    expect(screen.getByRole("heading", { name: "Quiz locked" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start quiz" })).toBeNull();
  });

  it("does not open modules outside the employee's path", () => {
    renderAt("/me/learning/leading-new-team", <ModuleView moduleId="leading-new-team" />);
    expect(screen.getByText("This module is not in your learning path")).toBeInTheDocument();
  });
});

describe("HR learning views", () => {
  it("shows the KPI tiles with definitions, the overdue list and both tables", () => {
    demoModeStore.setRole("hr");
    renderAt("/learning", <HrLearningView />);
    expect(screen.getByRole("heading", { level: 1, name: "Learning" })).toBeInTheDocument();

    const completion = screen.getByRole("group", { name: "Mandatory learning completion" });
    expect(completion).toHaveTextContent("88%");
    expect(completion).toHaveTextContent("14 of 16 mandatory assignments due by today");
    expect(screen.getByRole("group", { name: "Overdue assignments" })).toHaveTextContent("2");
    expect(screen.getByRole("group", { name: "In progress" })).toHaveTextContent("4");
    expect(screen.getByRole("group", { name: "Completed" })).toHaveTextContent("17");
    expect(screen.getByRole("region", { name: "How these figures are calculated" })).toHaveTextContent(
      "not validated business results",
    );

    const overdue = screen.getByRole("region", { name: "Overdue assignments" });
    expect(within(overdue).getByRole("link", { name: "Daniel Okafor" })).toHaveAttribute("href", "/onboarding/demo-daniel-okafor");
    expect(overdue).toHaveTextContent("Inês Duarte");

    expect(within(screen.getByRole("region", { name: "By employee" })).getAllByRole("row")).toHaveLength(11);
    expect(within(screen.getByRole("region", { name: "By module" })).getAllByRole("row")).toHaveLength(6);

    const mainNav = screen.getAllByRole("navigation", { name: "Main" })[0];
    expect(within(mainNav).getByRole("link", { name: "Learning" })).toHaveAttribute("href", "/learning");
  });

  it("shows read-only learning progress on the case page", () => {
    demoModeStore.setRole("hr");
    renderAt("/onboarding/demo-daniel-okafor", <CaseDetailView id="demo-daniel-okafor" />);
    const section = screen.getByRole("region", { name: "Learning progress" });
    expect(section).toHaveTextContent("1 of 4 mandatory modules completed");
    expect(section).toHaveTextContent("1 overdue");
    expect(section).toHaveTextContent("quiz passed (2 attempts)");
    expect(section).toHaveTextContent("does not change the readiness status");
    expect(within(section).queryByRole("button")).toBeNull();
  });
});
