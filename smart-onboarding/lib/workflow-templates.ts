import { addDays } from "@/lib/dates";
import type {
  ISODate,
  OnboardingTask,
  TaskTemplate,
  WorkflowContext,
  WorkflowModuleId,
} from "@/types/onboarding";

/**
 * Adaptive onboarding workflows.
 *
 * Every case receives the core module. Further modules are added based on the
 * workflow context: office or remote work, people managers and international hires.
 *
 * These are generic workflow examples, not legal, payroll or compliance instructions.
 * The international-hire module adds HR review tasks only. It never records or
 * automates eligibility or legal-compliance decisions.
 */

export const WORKFLOW_MODULES: Record<WorkflowModuleId, { label: string; description: string }> = {
  core: {
    label: "Core onboarding",
    description: "Applied to every case: documentation, payroll, IT access, Day 1 and the 30/60/90-day check-ins.",
  },
  office: {
    label: "Office employee",
    description: "Desk and building access plus an office walkthrough.",
  },
  remote: {
    label: "Remote employee",
    description: "Equipment delivery, a remote IT setup call and remote-working guidance.",
  },
  manager: {
    label: "People manager",
    description: "Team handover, manager permissions and first 1:1s with direct reports.",
  },
  international: {
    label: "International hire",
    description:
      "Additional HR review tasks only. Questions are routed to qualified specialists; no legal or eligibility decisions are made in this tool.",
  },
};

export const TASK_LIBRARY: readonly TaskTemplate[] = [
  // ---------------------------------------------------------------- core
  {
    module: "core",
    key: "employment-docs",
    title: "Prepare employment documentation checklist",
    description: "Gather the internal onboarding documents for the new hire and note anything still outstanding.",
    owner: "HR",
    stage: "Pre-boarding",
    offsetDays: -10,
    mandatory: true,
  },
  {
    module: "core",
    key: "new-hire-forms",
    title: "Complete new-hire onboarding forms",
    description: "The new employee completes the internal onboarding forms shared by HR.",
    owner: "New employee",
    stage: "Pre-boarding",
    offsetDays: -8,
    mandatory: true,
    dependsOn: ["employment-docs"],
  },
  {
    module: "core",
    key: "payroll-setup",
    title: "Confirm payroll setup requirements",
    description: "Confirm with Finance which details are needed before the first pay cycle.",
    owner: "Finance / Payroll",
    stage: "Pre-boarding",
    offsetDays: -7,
    mandatory: true,
    dependsOn: ["new-hire-forms"],
  },
  {
    module: "core",
    key: "account-provisioning",
    title: "Provision user account",
    description: "Create the directory account and mailbox once HR has confirmed the hire details.",
    owner: "IT",
    stage: "Pre-boarding",
    offsetDays: -5,
    mandatory: true,
    dependsOn: ["employment-docs"],
  },
  {
    module: "core",
    key: "equipment",
    title: "Prepare laptop and equipment",
    description: "Order, set up and label the laptop and peripherals for the role.",
    owner: "IT",
    stage: "Pre-boarding",
    offsetDays: -5,
    mandatory: true,
  },
  {
    module: "core",
    key: "system-access",
    title: "Set up system and application access",
    description: "Grant role-based access to the applications needed in the first weeks.",
    owner: "IT",
    stage: "Pre-boarding",
    offsetDays: -2,
    mandatory: true,
    dependsOn: ["account-provisioning"],
  },
  {
    module: "core",
    key: "buddy",
    title: "Assign an onboarding buddy",
    description: "Pair the new employee with a colleague for informal questions during the first weeks.",
    owner: "Hiring manager",
    stage: "Pre-boarding",
    offsetDays: -3,
    mandatory: false,
  },
  {
    module: "core",
    key: "first-week-agenda",
    title: "Create first-week agenda",
    description: "Share a first-week plan with key meetings, introductions and early learning goals.",
    owner: "Hiring manager",
    stage: "Pre-boarding",
    offsetDays: -2,
    mandatory: true,
  },
  {
    module: "core",
    key: "welcome-orientation",
    title: "Welcome meeting and company orientation",
    description: "Welcome the new employee and walk through the organisation and practical information.",
    owner: "HR",
    stage: "Day 1",
    offsetDays: 0,
    mandatory: true,
  },
  {
    module: "core",
    key: "team-intro",
    title: "Team introduction and role overview",
    description: "Introduce the team and discuss the role, responsibilities and ways of working.",
    owner: "Hiring manager",
    stage: "Day 1",
    offsetDays: 0,
    mandatory: true,
    dependsOn: ["first-week-agenda"],
  },
  {
    module: "core",
    key: "confirm-access",
    title: "Confirm equipment and system access",
    description: "Check the employee can log in and use the tools needed for the first week.",
    owner: "IT",
    stage: "Day 1",
    offsetDays: 0,
    mandatory: true,
    dependsOn: ["equipment", "system-access"],
  },
  {
    module: "core",
    key: "first-month-checkin",
    title: "First-month check-in",
    description: "Review the first month, clarify priorities and agree goals for the next period.",
    owner: "Hiring manager",
    stage: "First 30 days",
    offsetDays: 30,
    mandatory: true,
  },
  {
    module: "core",
    key: "feedback-checkin",
    title: "New employee feedback check-in",
    description: "Ask the new employee how onboarding is going and capture improvement ideas.",
    owner: "HR",
    stage: "First 30 days",
    offsetDays: 30,
    mandatory: true,
  },
  {
    module: "core",
    key: "experience-survey",
    title: "Share onboarding experience feedback",
    description: "Optional short survey for the new employee about the onboarding experience.",
    owner: "New employee",
    stage: "First 30 days",
    offsetDays: 30,
    mandatory: false,
  },
  {
    module: "core",
    key: "role-progress",
    title: "Role progress and support check-in",
    description: "Discuss progress against early goals and any support or training needed.",
    owner: "Hiring manager",
    stage: "Day 60",
    offsetDays: 60,
    mandatory: true,
    dependsOn: ["first-month-checkin"],
  },
  {
    module: "core",
    key: "ninety-day-review",
    title: "90-day review and next-step discussion",
    description: "Reflect on the first 90 days together and agree next steps and development focus.",
    owner: "HR + Hiring manager",
    stage: "Day 90",
    offsetDays: 90,
    mandatory: true,
    dependsOn: ["role-progress"],
  },

  // -------------------------------------------------------------- office
  {
    module: "office",
    key: "desk-access",
    title: "Prepare desk and building access",
    description: "Allocate a desk or hybrid seat and arrange a building badge.",
    owner: "Facilities",
    stage: "Pre-boarding",
    offsetDays: -2,
    mandatory: true,
  },
  {
    module: "office",
    key: "office-tour",
    title: "Office walkthrough",
    description: "Show the new employee around the office, meeting rooms and shared facilities.",
    owner: "Facilities",
    stage: "Day 1",
    offsetDays: 0,
    mandatory: false,
    dependsOn: ["desk-access"],
  },

  // -------------------------------------------------------------- remote
  {
    module: "remote",
    key: "remote-guidelines",
    title: "Share remote-working guidelines",
    description: "Send the internal remote-working guide and team collaboration norms.",
    owner: "HR",
    stage: "Pre-boarding",
    offsetDays: -5,
    mandatory: false,
  },
  {
    module: "remote",
    key: "equipment-delivery",
    title: "Deliver equipment to the employee",
    description: "Arrange delivery of the prepared laptop and peripherals and confirm receipt.",
    owner: "IT",
    stage: "Pre-boarding",
    offsetDays: -3,
    mandatory: true,
    dependsOn: ["equipment"],
  },
  {
    module: "remote",
    key: "remote-setup-call",
    title: "Remote IT setup call",
    description: "Walk the employee through first login, VPN and collaboration tools on a video call.",
    owner: "IT",
    stage: "Day 1",
    offsetDays: 0,
    mandatory: true,
    dependsOn: ["equipment-delivery", "system-access"],
  },

  // ------------------------------------------------------------- manager
  {
    module: "manager",
    key: "manager-handover",
    title: "Prepare team handover briefing",
    description: "Summarise team context, open priorities and direct-report information for the new manager.",
    owner: "Hiring manager",
    stage: "Pre-boarding",
    offsetDays: -3,
    mandatory: true,
  },
  {
    module: "manager",
    key: "manager-permissions",
    title: "Grant people-manager system permissions",
    description: "Enable manager views and approval rights in internal tools.",
    owner: "IT",
    stage: "Pre-boarding",
    offsetDays: -2,
    mandatory: true,
    dependsOn: ["account-provisioning"],
  },
  {
    module: "manager",
    key: "direct-report-1on1s",
    title: "Hold first 1:1s with direct reports",
    description: "The new manager meets each direct report individually.",
    owner: "New employee",
    stage: "First 30 days",
    offsetDays: 21,
    mandatory: true,
    dependsOn: ["manager-handover"],
  },
  {
    module: "manager",
    key: "manager-resources",
    title: "Introduce manager development resources",
    description: "Share internal manager guides and optional development sessions.",
    owner: "HR",
    stage: "First 30 days",
    offsetDays: 30,
    mandatory: false,
  },

  // ------------------------------------------------------- international
  {
    module: "international",
    key: "intl-hr-review",
    title: "HR review of international hire context",
    description:
      "HR reviews the cross-border context and lists open questions for qualified specialists. No eligibility or legal decision is made or recorded here.",
    owner: "HR",
    stage: "Pre-boarding",
    offsetDays: -21,
    mandatory: true,
  },
  {
    module: "international",
    key: "intl-hr-followup",
    title: "Follow up open HR review questions",
    description:
      "HR confirms that questions raised in the review have been routed to and answered by the appropriate specialists.",
    owner: "HR",
    stage: "Pre-boarding",
    offsetDays: -10,
    mandatory: true,
    dependsOn: ["intl-hr-review"],
  },
  {
    module: "international",
    key: "intl-arrival-info",
    title: "Share arrival and relocation information",
    description: "Send practical arrival information prepared by HR, such as the first-day location and contacts.",
    owner: "HR",
    stage: "Pre-boarding",
    offsetDays: -7,
    mandatory: false,
    dependsOn: ["intl-hr-review"],
  },
];

export const DEFAULT_WORKFLOW: WorkflowContext = {
  workArrangement: "Office",
  peopleManager: false,
  internationalHire: false,
};

/** Which modules apply to a given context, in display order. */
export function modulesFor(context: WorkflowContext): WorkflowModuleId[] {
  const modules: WorkflowModuleId[] = ["core", context.workArrangement === "Remote" ? "remote" : "office"];
  if (context.peopleManager) modules.push("manager");
  if (context.internationalHire) modules.push("international");
  return modules;
}

/** Short human label, e.g. "Remote · People manager · International hire". */
export function workflowLabel(context: WorkflowContext): string {
  return [
    context.workArrangement,
    context.peopleManager ? "People manager" : null,
    context.internationalHire ? "International hire" : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The task templates for a context, with dependencies limited to tasks that exist in it. */
export function buildWorkflowTemplate(context: WorkflowContext): TaskTemplate[] {
  const modules = new Set(modulesFor(context));
  const templates = TASK_LIBRARY.filter((t) => modules.has(t.module));
  const keys = new Set(templates.map((t) => t.key));
  return templates
    .map((t) => ({ ...t, dependsOn: (t.dependsOn ?? []).filter((key) => keys.has(key)) }))
    .sort((a, b) => a.offsetDays - b.offsetDays);
}

export function findTemplate(key: string): TaskTemplate | undefined {
  return TASK_LIBRARY.find((t) => t.key === key);
}

/** Generates a fresh task list for a case, with due dates relative to the start date. */
export function generateTasks(
  caseId: string,
  startDate: ISODate,
  context: WorkflowContext = DEFAULT_WORKFLOW,
): OnboardingTask[] {
  return buildWorkflowTemplate(context).map((item) => ({
    id: `${caseId}--${item.key}`,
    templateKey: item.key,
    title: item.title,
    description: item.description,
    owner: item.owner,
    stage: item.stage,
    dueDate: addDays(startDate, item.offsetDays),
    status: "Not started",
    mandatory: item.mandatory,
    dependsOn: item.dependsOn ?? [],
    blockedCount: 0,
  }));
}
