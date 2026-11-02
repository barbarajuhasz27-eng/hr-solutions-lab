import { describe, expect, it } from "vitest";
import { createCase } from "@/lib/onboarding-store";
import {
  buildWorkflowTemplate,
  DEFAULT_WORKFLOW,
  generateTasks,
  modulesFor,
  TASK_LIBRARY,
  workflowLabel,
} from "@/lib/workflow-templates";
import type { NewOnboardingInput, WorkflowContext } from "@/types/onboarding";

const office: WorkflowContext = { workArrangement: "Office", peopleManager: false, internationalHire: false };
const remote: WorkflowContext = { ...office, workArrangement: "Remote" };
const manager: WorkflowContext = { ...office, peopleManager: true };
const international: WorkflowContext = { ...office, internationalHire: true };

const keys = (context: WorkflowContext) => buildWorkflowTemplate(context).map((t) => t.key);

describe("adaptive workflow composition", () => {
  it("selects modules from the context", () => {
    expect(modulesFor(office)).toEqual(["core", "office"]);
    expect(modulesFor(remote)).toEqual(["core", "remote"]);
    expect(modulesFor({ workArrangement: "Remote", peopleManager: true, internationalHire: true })).toEqual([
      "core",
      "remote",
      "manager",
      "international",
    ]);
  });

  it("generates different task sets per context", () => {
    expect(keys(office)).toHaveLength(18);
    expect(keys(remote)).toHaveLength(19);
    expect(keys(manager)).toHaveLength(22);
    expect(keys(international)).toHaveLength(21);

    expect(keys(office)).toContain("desk-access");
    expect(keys(remote)).not.toContain("desk-access");
    expect(keys(remote)).toEqual(expect.arrayContaining(["equipment-delivery", "remote-setup-call"]));
    expect(keys(manager)).toEqual(
      expect.arrayContaining(["manager-handover", "manager-permissions", "direct-report-1on1s"]),
    );
    expect(keys(office)).not.toContain("manager-handover");
  });

  it("adds HR review tasks only for international hires", () => {
    const extra = buildWorkflowTemplate(international).filter((t) => !keys(office).includes(t.key));
    expect(extra.map((t) => t.key)).toEqual(["intl-hr-review", "intl-hr-followup", "intl-arrival-info"]);
    expect(extra.every((t) => t.owner === "HR")).toBe(true);
    // No task anywhere approves, confirms or decides eligibility or legal compliance.
    const decisionWording =
      /(approve|confirm|decide|verify|grant)s? (the )?(eligibility|right to work|visa|work permit|legal|compliance)|legally compliant|eligibility (is )?(approved|confirmed|granted|verified)/i;
    for (const t of TASK_LIBRARY) {
      expect(`${t.title} ${t.description}`).not.toMatch(decisionWording);
    }
    expect(extra[0].description).toMatch(/No eligibility or legal decision/);
  });

  it("classifies tasks as mandatory or optional", () => {
    const template = buildWorkflowTemplate(office);
    expect(template.filter((t) => !t.mandatory).map((t) => t.key).sort()).toEqual(
      ["buddy", "experience-survey", "office-tour"].sort(),
    );
  });

  it("drops dependencies on tasks that are not part of the workflow", () => {
    const officeTour = buildWorkflowTemplate(office).find((t) => t.key === "office-tour");
    expect(officeTour?.dependsOn).toEqual(["desk-access"]);
    expect(keys(remote)).not.toContain("office-tour");
  });

  it("labels the workflow", () => {
    expect(workflowLabel(office)).toBe("Office");
    expect(workflowLabel({ workArrangement: "Remote", peopleManager: true, internationalHire: true })).toBe(
      "Remote · People manager · International hire",
    );
  });
});

describe("generateTasks", () => {
  it("creates tasks with unique ids, defaults and template metadata", () => {
    const tasks = generateTasks("case-1", "2026-11-16", manager);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
    expect(tasks.every((t) => t.status === "Not started" && t.blockedCount === 0 && !t.completedAt)).toBe(true);
    expect(tasks.find((t) => t.templateKey === "system-access")).toMatchObject({
      mandatory: true,
      owner: "IT",
      stage: "Pre-boarding",
      dependsOn: ["account-provisioning"],
    });
  });

  it("calculates due dates across a year boundary", () => {
    const due = Object.fromEntries(
      generateTasks("c", "2027-01-04", international).map((t) => [t.templateKey, t.dueDate]),
    );
    expect(due["intl-hr-review"]).toBe("2026-12-14"); // -21
    expect(due["employment-docs"]).toBe("2026-12-25"); // -10
    expect(due["payroll-setup"]).toBe("2026-12-28"); // -7
    expect(due["equipment"]).toBe("2026-12-30"); // -5
    expect(due["system-access"]).toBe("2027-01-02"); // -2
    expect(due["welcome-orientation"]).toBe("2027-01-04"); // 0
    expect(due["first-month-checkin"]).toBe("2027-02-03"); // +30
    expect(due["role-progress"]).toBe("2027-03-05"); // +60
    expect(due["ninety-day-review"]).toBe("2027-04-04"); // +90
  });

  it("calculates due dates across month boundaries, including February", () => {
    const due = Object.fromEntries(generateTasks("c", "2026-03-01").map((t) => [t.templateKey, t.dueDate]));
    expect(due["employment-docs"]).toBe("2026-02-19");
    expect(due["system-access"]).toBe("2026-02-27");
    expect(due["feedback-checkin"]).toBe("2026-03-31");
    expect(due["role-progress"]).toBe("2026-04-30");
    expect(due["ninety-day-review"]).toBe("2026-05-30");
  });

  it("defaults to the office workflow", () => {
    expect(generateTasks("c", "2026-11-16").map((t) => t.templateKey)).toEqual(keys(DEFAULT_WORKFLOW));
  });
});

describe("createCase", () => {
  const input: NewOnboardingInput = {
    employeeName: "Test Person",
    jobTitle: "Analyst",
    department: "Operations",
    hiringManager: "Test Manager",
    location: "Remote",
    startDate: "2027-01-04",
    employmentType: "Part-time",
    workflow: remote,
  };

  it("generates the workflow for the case's context", () => {
    const created = createCase(input, { id: "new-case", now: new Date("2026-11-02T10:00:00Z") });
    expect(created).toMatchObject({ id: "new-case", ...input, createdAt: "2026-11-02T10:00:00.000Z" });
    expect(created.tasks.map((t) => t.templateKey)).toEqual(keys(remote));
    expect(created.tasks.every((t) => t.id.startsWith("new-case--"))).toBe(true);
  });

  it("generates an id when none is given", () => {
    expect(createCase(input).id).not.toBe(createCase(input).id);
  });
});
