import { describe, expect, it } from "vitest";
import {
  caseHealth,
  completionPercent,
  currentStage,
  filterTasks,
  flattenTasks,
  getAttentionItems,
  getDashboardMetrics,
  getMilestones,
  getUpcomingStarts,
  isTaskDueSoon,
  isTaskOverdue,
  matchesCaseQuery,
  nextMilestone,
} from "@/lib/metrics";
import { createCase } from "@/lib/onboarding-store";
import { createSeedCases } from "@/lib/seed-data";
import { DEFAULT_WORKFLOW } from "@/lib/workflow-templates";
import type { OnboardingCase, OnboardingTask } from "@/types/onboarding";
import { makeTask, TODAY } from "./helpers";

const task = (overrides: Partial<OnboardingTask> = {}): OnboardingTask => ({
  ...makeTask({ key: "t", dueIn: 0 }),
  ...overrides,
});

function officeCase(startDate: string): OnboardingCase {
  return createCase(
    {
      employeeName: "Alex Example",
      jobTitle: "Engineer",
      department: "Engineering",
      hiringManager: "Manager",
      location: "Remote",
      startDate,
      employmentType: "Full-time",
      workflow: DEFAULT_WORKFLOW,
    },
    { id: `case-${startDate}` },
  );
}

const complete = (c: OnboardingCase, predicate: (t: OnboardingTask) => boolean = () => true): OnboardingCase => ({
  ...c,
  tasks: c.tasks.map((t) => (predicate(t) ? { ...t, status: "Completed" as const, completedAt: TODAY } : t)),
});

describe("completionPercent", () => {
  it("returns 0 for an empty list", () => {
    expect(completionPercent([])).toBe(0);
  });

  it("is based on the total task count, regardless of other statuses", () => {
    const tasks = [
      task({ status: "Completed" }),
      task({ status: "Blocked" }),
      task({ status: "In progress" }),
      task({ status: "Not started" }),
    ];
    expect(completionPercent(tasks)).toBe(25);
  });

  it("rounds to whole numbers", () => {
    expect(completionPercent([task({ status: "Completed" }), task(), task()])).toBe(33);
    expect(completionPercent([task({ status: "Completed" }), task({ status: "Completed" }), task()])).toBe(67);
  });

  it("reaches 100 only when every task is completed", () => {
    const allDone = complete(officeCase("2026-10-01")).tasks;
    expect(completionPercent(allDone)).toBe(100);
    expect(completionPercent([...allDone.slice(1), task()])).toBe(94); // 17 of 18
  });
});

describe("overdue logic", () => {
  it("marks open tasks with a past due date as overdue", () => {
    expect(isTaskOverdue(task({ dueDate: "2026-11-01" }), TODAY)).toBe(true);
    expect(isTaskOverdue(task({ dueDate: "2026-11-01", status: "In progress" }), TODAY)).toBe(true);
    expect(isTaskOverdue(task({ dueDate: "2026-11-01", status: "Blocked" }), TODAY)).toBe(true);
  });

  it("never marks completed tasks as overdue", () => {
    expect(isTaskOverdue(task({ dueDate: "2025-01-01", status: "Completed" }), TODAY)).toBe(false);
  });

  it("does not mark tasks due today or later as overdue", () => {
    expect(isTaskOverdue(task({ dueDate: TODAY }), TODAY)).toBe(false);
    expect(isTaskOverdue(task({ dueDate: "2026-11-30" }), TODAY)).toBe(false);
  });

  it("handles overdue checks across a year boundary", () => {
    expect(isTaskOverdue(task({ dueDate: "2026-12-31" }), "2027-01-01")).toBe(true);
  });

  it("flags tasks due within the next 7 days as due soon, excluding completed ones", () => {
    expect(isTaskDueSoon(task({ dueDate: TODAY }), TODAY)).toBe(true);
    expect(isTaskDueSoon(task({ dueDate: "2026-11-09" }), TODAY)).toBe(true);
    expect(isTaskDueSoon(task({ dueDate: "2026-11-10" }), TODAY)).toBe(false);
    expect(isTaskDueSoon(task({ dueDate: "2026-11-03", status: "Completed" }), TODAY)).toBe(false);
    expect(isTaskDueSoon(task({ dueDate: "2026-11-01" }), TODAY)).toBe(false);
  });
});

describe("case stage and milestones", () => {
  it("starts in Pre-boarding and moves on as stages complete", () => {
    const fresh = officeCase("2026-11-20");
    expect(currentStage(fresh)).toBe("Pre-boarding");
    expect(currentStage(complete(fresh, (t) => t.stage === "Pre-boarding"))).toBe("Day 1");

    const allDone = complete(fresh);
    expect(currentStage(allDone)).toBe("Completed");
    expect(caseHealth(allDone, TODAY)).toBe("Completed");
  });

  it("calculates milestone dates and statuses from the start date", () => {
    const c = officeCase("2026-10-01");
    const milestones = getMilestones(c, TODAY);
    expect(milestones.map((m) => [m.label, m.date])).toEqual([
      ["Day 1", "2026-10-01"],
      ["Day 30", "2026-10-31"],
      ["Day 60", "2026-11-30"],
      ["Day 90", "2026-12-30"],
    ]);
    expect(milestones.map((m) => m.status)).toEqual(["Overdue", "Overdue", "Upcoming", "Upcoming"]);
    // Day 1 gates on the mandatory pre-boarding and Day 1 tasks; optional tasks are listed separately.
    expect(milestones[0]).toMatchObject({ totalTasks: 11, optionalTasks: 2 });
  });

  it("treats the next milestone as the next one by date", () => {
    expect(nextMilestone(officeCase("2026-10-01"), TODAY)?.label).toBe("Day 60");
    expect(nextMilestone(officeCase("2026-11-20"), TODAY)?.label).toBe("Day 1");
    expect(nextMilestone(complete(officeCase("2026-06-01")), TODAY)).toBeNull();
  });

  it("marks milestones due within a week as due soon", () => {
    expect(getMilestones(officeCase("2026-11-06"), TODAY)[0].status).toBe("Due soon");
  });
});

describe("dashboard metrics", () => {
  const seed = createSeedCases(TODAY);

  it("derives metrics from the seed data", () => {
    const metrics = getDashboardMetrics(seed, TODAY);
    const all = seed.flatMap((c) => c.tasks);
    expect(metrics.totalTasks).toBe(all.length);
    expect(metrics.totalTasks).toBe(197);
    expect(metrics.upcomingStarts).toBe(4);
    expect(metrics.activeOnboardings).toBe(8);
    expect(metrics.overdueTasks).toBe(5);
    expect(metrics.blockedTasks).toBe(1);
    expect(metrics.completedTasks).toBe(all.filter((t) => t.status === "Completed").length);
    expect(metrics.overallCompletion).toBe(Math.round((metrics.completedTasks / metrics.totalTasks) * 100));
  });

  it("includes blocked and overdue tasks in the attention list, sorted by due date", () => {
    const items = getAttentionItems(seed, TODAY);
    expect(items).toHaveLength(6);
    expect(items.some((i) => i.isBlocked && i.employeeName === "Maya Lindqvist")).toBe(true);
    const dates = items.map((i) => i.dueDate);
    expect([...dates].sort()).toEqual(dates);
  });

  it("lists upcoming starts within 30 days only, soonest first", () => {
    expect(getUpcomingStarts(seed, TODAY).map((c) => c.employeeName)).toEqual([
      "Tomás Herrera",
      "Maya Lindqvist",
      "Aiko Tanaka",
      "Noah Adeyemi",
    ]);
    expect(getUpcomingStarts([officeCase("2026-12-03")], TODAY)).toHaveLength(0);
    expect(getUpcomingStarts([officeCase("2026-12-02")], TODAY)).toHaveLength(1);
  });

  it("returns zeros for an empty workspace", () => {
    expect(getDashboardMetrics([], TODAY)).toEqual({
      upcomingStarts: 0,
      activeOnboardings: 0,
      overdueTasks: 0,
      blockedTasks: 0,
      completedTasks: 0,
      totalTasks: 0,
      overallCompletion: 0,
    });
  });
});

describe("search and filters", () => {
  const seed = createSeedCases(TODAY);
  const all = flattenTasks(seed);

  it("matches cases by name, role or department, case-insensitively", () => {
    expect(matchesCaseQuery(seed[0], "maya")).toBe(true);
    expect(matchesCaseQuery(seed[0], "DESIGNER")).toBe(true);
    expect(matchesCaseQuery(seed[0], "product")).toBe(true);
    expect(matchesCaseQuery(seed[0], "finance")).toBe(false);
    expect(matchesCaseQuery(seed[0], "  ")).toBe(true);
  });

  it("filters tasks by status, owner, derived overdue state, requirement and search", () => {
    expect(filterTasks(all, { status: "Blocked", owner: "All" }, TODAY)).toHaveLength(1);
    expect(filterTasks(all, { status: "Overdue", owner: "All" }, TODAY)).toHaveLength(5);
    expect(filterTasks(all, { status: "All", owner: "IT" }, TODAY)).toHaveLength(48);

    const optional = filterTasks(all, { status: "All", owner: "All", requirement: "Optional" }, TODAY);
    const mandatory = filterTasks(all, { status: "All", owner: "All", requirement: "Mandatory" }, TODAY);
    expect(optional.every((t) => !t.mandatory)).toBe(true);
    expect(optional.length + mandatory.length).toBe(all.length);

    // Two of the five overdue tasks are mandatory; the rest are optional.
    expect(filterTasks(all, { status: "Overdue", owner: "All", requirement: "Mandatory" }, TODAY)).toHaveLength(2);

    expect(
      filterTasks(all, { status: "All", owner: "All", query: "okafor" }, TODAY).every(
        (t) => t.employeeName === "Daniel Okafor",
      ),
    ).toBe(true);
  });
});
