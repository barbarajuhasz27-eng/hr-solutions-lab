export const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Fixed-term"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const TASK_STATUSES = ["Not started", "In progress", "Completed", "Blocked"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ONBOARDING_STAGES = [
  "Pre-boarding",
  "Day 1",
  "First 30 days",
  "Day 60",
  "Day 90",
] as const;
export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

export const TASK_OWNERS = [
  "HR",
  "IT",
  "Finance / Payroll",
  "Facilities",
  "Hiring manager",
  "HR + Hiring manager",
  "New employee",
] as const;
export type TaskOwner = (typeof TASK_OWNERS)[number];

export const WORK_ARRANGEMENTS = ["Office", "Remote"] as const;
export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number];

/** The context that decides which workflow modules are applied to a case. */
export type WorkflowContext = {
  workArrangement: WorkArrangement;
  peopleManager: boolean;
  internationalHire: boolean;
};

/** A calendar date in local time, formatted YYYY-MM-DD. */
export type ISODate = string;

export type OnboardingTask = {
  id: string;
  /** Key of the template entry this task was generated from (unique within a case). */
  templateKey: string;
  title: string;
  description: string;
  owner: TaskOwner;
  stage: OnboardingStage;
  dueDate: ISODate;
  status: TaskStatus;
  completedAt?: ISODate;
  /** Mandatory tasks gate milestone readiness; optional tasks never do. */
  mandatory: boolean;
  /** Template keys of prerequisite tasks in the same case. */
  dependsOn: string[];
  /** How many times the task has been moved into "Blocked" (used for recurring-blocker insights). */
  blockedCount: number;
  blockedReason?: string;
};

/** A fictional colleague who supports the new employee. No contact details are stored. */
export type SupportContact = {
  name: string;
  role: string;
};

/**
 * People supporting the new employee besides the hiring manager (kept in `hiringManager`,
 * so there is a single source of truth for the manager's name).
 */
export type CaseContacts = {
  hrPartner: SupportContact;
  buddy: SupportContact;
};

export type OnboardingCase = {
  id: string;
  employeeName: string;
  jobTitle: string;
  department: string;
  hiringManager: string;
  location: string;
  startDate: ISODate;
  employmentType: EmploymentType;
  workflow: WorkflowContext;
  contacts: CaseContacts;
  tasks: OnboardingTask[];
  createdAt: string;
};

/** Input for a new case. Contacts are optional and assigned automatically when omitted. */
export type NewOnboardingInput = Omit<OnboardingCase, "id" | "tasks" | "createdAt" | "contacts"> & {
  contacts?: CaseContacts;
};

export type WorkflowModuleId = "core" | "office" | "remote" | "manager" | "international";

export type TaskTemplate = {
  key: string;
  title: string;
  description: string;
  owner: TaskOwner;
  stage: OnboardingStage;
  /** Days relative to the start date (negative = before Day 1). */
  offsetDays: number;
  mandatory: boolean;
  /** Template keys this task depends on. Keys not present in a generated workflow are ignored. */
  dependsOn?: string[];
  module: WorkflowModuleId;
};
