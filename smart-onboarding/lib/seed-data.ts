import { addDays, diffInDays } from "@/lib/dates";
import { generateTasks } from "@/lib/workflow-templates";
import type {
  CaseContacts,
  ISODate,
  NewOnboardingInput,
  OnboardingCase,
  OnboardingTask,
  TaskStatus,
} from "@/types/onboarding";

type TaskOverride = {
  status?: TaskStatus;
  /** Days after the due date that a completed task was completed. */
  lateDays?: number;
  blockedCount?: number;
  blockedReason?: string;
};

type SeedDefinition = {
  id: string;
  input: Omit<NewOnboardingInput, "startDate" | "contacts"> & { contacts: CaseContacts };
  /** Start date relative to today, so the demo stays current. */
  startOffsetDays: number;
  createdOffsetDays: number;
  /** Tasks whose due offset is at or before this value start as Completed (null = none). */
  completedThroughOffset: number | null;
  overrides?: Record<string, TaskOverride>;
};

/**
 * Ten fictional onboarding cases covering every workflow variant and readiness status, including
 * one onboarding that has already been completed.
 * All names, roles and locations are synthetic.
 */
const SEED_DEFINITIONS: readonly SeedDefinition[] = [
  {
    id: "demo-maya-lindqvist",
    input: {
      employeeName: "Maya Lindqvist",
      jobTitle: "Product Designer",
      department: "Product",
      hiringManager: "Jonas Berg",
      location: "Lisbon office (hybrid)",
      employmentType: "Full-time",
      workflow: { workArrangement: "Office", peopleManager: false, internationalHire: false },
      contacts: {
        hrPartner: { name: "Clara Mendes", role: "People Partner" },
        buddy: { name: "Felix Andersen", role: "Onboarding buddy" },
      },
    },
    startOffsetDays: 12,
    createdOffsetDays: -9,
    completedThroughOffset: null,
    overrides: {
      "employment-docs": { status: "Completed" },
      "new-hire-forms": { status: "In progress" },
      "account-provisioning": { status: "In progress" },
      equipment: {
        status: "Blocked",
        blockedCount: 1,
        blockedReason: "Laptop model on back-order with the supplier",
      },
    },
  },
  {
    id: "demo-daniel-okafor",
    input: {
      employeeName: "Daniel Okafor",
      jobTitle: "Data Analyst",
      department: "Finance",
      hiringManager: "Priya Raman",
      location: "Remote — Berlin",
      employmentType: "Full-time",
      workflow: { workArrangement: "Remote", peopleManager: false, internationalHire: false },
      contacts: {
        hrPartner: { name: "Amara Osei", role: "People Partner" },
        buddy: { name: "Mei Lin", role: "Onboarding buddy" },
      },
    },
    startOffsetDays: -8,
    createdOffsetDays: -30,
    completedThroughOffset: 0,
    overrides: {
      "new-hire-forms": { lateDays: 2 },
      "account-provisioning": {
        lateDays: 2,
        blockedCount: 1,
        blockedReason: "Hire details not yet confirmed by HR",
      },
      "equipment-delivery": { lateDays: 3 },
      "remote-setup-call": { lateDays: 2 },
      "remote-guidelines": { status: "Not started" },
      "confirm-access": { status: "In progress" },
    },
  },
  {
    id: "demo-sofia-marin",
    input: {
      employeeName: "Sofia Marin",
      jobTitle: "Customer Success Lead",
      department: "Customer Success",
      hiringManager: "Elena Novak",
      location: "Amsterdam office",
      employmentType: "Fixed-term",
      workflow: { workArrangement: "Office", peopleManager: false, internationalHire: true },
      contacts: {
        hrPartner: { name: "Jonah Whitaker", role: "People Partner" },
        buddy: { name: "Lucía Romero", role: "Onboarding buddy" },
      },
    },
    startOffsetDays: -47,
    createdOffsetDays: -70,
    completedThroughOffset: 30,
    overrides: {
      "intl-hr-review": { lateDays: 5 },
      "first-month-checkin": { lateDays: 4 },
      "feedback-checkin": { status: "Not started" },
      "experience-survey": { status: "Not started" },
      "role-progress": { status: "In progress" },
    },
  },
  {
    id: "demo-tomas-herrera",
    input: {
      employeeName: "Tomás Herrera",
      jobTitle: "Engineering Manager",
      department: "Engineering",
      hiringManager: "Grace Whitfield",
      location: "Lisbon office",
      employmentType: "Full-time",
      workflow: { workArrangement: "Office", peopleManager: true, internationalHire: false },
      contacts: {
        hrPartner: { name: "Clara Mendes", role: "People Partner" },
        buddy: { name: "Kwame Asante", role: "Onboarding buddy" },
      },
    },
    startOffsetDays: 5,
    createdOffsetDays: -20,
    completedThroughOffset: -6,
    overrides: {
      "new-hire-forms": { lateDays: 1 },
      equipment: { status: "Completed" },
      "desk-access": { status: "Completed" },
      "account-provisioning": { status: "In progress" },
      "first-week-agenda": { status: "In progress" },
    },
  },
  {
    id: "demo-aiko-tanaka",
    input: {
      employeeName: "Aiko Tanaka",
      jobTitle: "UX Researcher",
      department: "Product",
      hiringManager: "Jonas Berg",
      location: "Remote — Osaka",
      employmentType: "Full-time",
      workflow: { workArrangement: "Remote", peopleManager: false, internationalHire: true },
      contacts: {
        hrPartner: { name: "Amara Osei", role: "People Partner" },
        buddy: { name: "Felix Andersen", role: "Onboarding buddy" },
      },
    },
    startOffsetDays: 20,
    createdOffsetDays: -10,
    completedThroughOffset: null,
    overrides: {
      "intl-hr-review": { status: "Completed" },
    },
  },
  {
    id: "demo-lena-fischer",
    input: {
      employeeName: "Lena Fischer",
      jobTitle: "Finance Business Partner",
      department: "Finance",
      hiringManager: "Priya Raman",
      location: "Amsterdam office",
      employmentType: "Full-time",
      workflow: { workArrangement: "Office", peopleManager: false, internationalHire: false },
      contacts: {
        hrPartner: { name: "Jonah Whitaker", role: "People Partner" },
        buddy: { name: "Oskar Nilsson", role: "Onboarding buddy" },
      },
    },
    startOffsetDays: -95,
    createdOffsetDays: -120,
    completedThroughOffset: 90,
    overrides: {
      "new-hire-forms": { lateDays: 3 },
      "account-provisioning": {
        lateDays: 1,
        blockedCount: 1,
        blockedReason: "Hire details not yet confirmed by HR",
      },
      equipment: { lateDays: 2, blockedCount: 1, blockedReason: "Supplier delivery delay" },
    },
  },
  {
    // Completed onboarding (day 110). Gives the Day 7 experience group a fifth fictional employee.
    id: "demo-rafael-costa",
    input: {
      employeeName: "Rafael Costa",
      jobTitle: "Customer Support Specialist",
      department: "Customer Success",
      hiringManager: "Elena Varga",
      location: "Lisbon office",
      employmentType: "Full-time",
      workflow: { workArrangement: "Office", peopleManager: false, internationalHire: false },
      contacts: {
        hrPartner: { name: "Clara Mendes", role: "People Partner" },
        buddy: { name: "Lucía Romero", role: "Onboarding buddy" },
      },
    },
    startOffsetDays: -110,
    createdOffsetDays: -135,
    completedThroughOffset: 90,
  },
  {
    id: "demo-marcus-bell",
    input: {
      employeeName: "Marcus Bell",
      jobTitle: "Sales Team Lead",
      department: "Sales",
      hiringManager: "Hannah Olsen",
      location: "Remote — Dublin",
      employmentType: "Full-time",
      workflow: { workArrangement: "Remote", peopleManager: true, internationalHire: false },
      contacts: {
        hrPartner: { name: "Amara Osei", role: "People Partner" },
        buddy: { name: "Kwame Asante", role: "Onboarding buddy" },
      },
    },
    startOffsetDays: -25,
    createdOffsetDays: -50,
    completedThroughOffset: 21,
    overrides: {
      equipment: { lateDays: 3, blockedCount: 1, blockedReason: "Laptop model on back-order with the supplier" },
      "equipment-delivery": {
        lateDays: 4,
        blockedCount: 1,
        blockedReason: "Courier could not complete the delivery",
      },
      "remote-setup-call": { lateDays: 1 },
      "manager-handover": { lateDays: 2 },
      "feedback-checkin": { status: "In progress" },
    },
  },
  {
    id: "demo-ines-duarte",
    input: {
      employeeName: "Inês Duarte",
      jobTitle: "Operations Coordinator",
      department: "Operations",
      hiringManager: "Samuel Achterberg",
      location: "Lisbon office",
      employmentType: "Part-time",
      workflow: { workArrangement: "Office", peopleManager: false, internationalHire: false },
      contacts: {
        hrPartner: { name: "Clara Mendes", role: "People Partner" },
        buddy: { name: "Lucía Romero", role: "Onboarding buddy" },
      },
    },
    startOffsetDays: -40,
    createdOffsetDays: -65,
    completedThroughOffset: 60,
    overrides: {
      "experience-survey": { status: "Not started" },
    },
  },
  {
    id: "demo-noah-adeyemi",
    input: {
      employeeName: "Noah Adeyemi",
      jobTitle: "Junior Accountant",
      department: "Finance",
      hiringManager: "Priya Raman",
      location: "Amsterdam office",
      employmentType: "Full-time",
      workflow: { workArrangement: "Office", peopleManager: false, internationalHire: false },
      contacts: {
        hrPartner: { name: "Jonah Whitaker", role: "People Partner" },
        buddy: { name: "Mei Lin", role: "Onboarding buddy" },
      },
    },
    startOffsetDays: 30,
    createdOffsetDays: -1,
    completedThroughOffset: null,
  },
];

export const SEED_CASE_IDS = SEED_DEFINITIONS.map((d) => d.id);

function applySeedState(
  task: OnboardingTask,
  startDate: ISODate,
  today: ISODate,
  definition: SeedDefinition,
): OnboardingTask {
  const offset = diffInDays(startDate, task.dueDate);
  const override = definition.overrides?.[task.templateKey] ?? {};
  const baseStatus: TaskStatus =
    definition.completedThroughOffset !== null && offset <= definition.completedThroughOffset
      ? "Completed"
      : "Not started";
  const status = override.status ?? baseStatus;
  const blockedCount = override.blockedCount ?? (status === "Blocked" ? 1 : 0);
  const next: OnboardingTask = { ...task, status, blockedCount };
  if (override.blockedReason) next.blockedReason = override.blockedReason;
  if (status === "Completed") {
    // Completed on the due date (plus any delay), never later than today.
    const completedOn = addDays(task.dueDate, override.lateDays ?? 0);
    next.completedAt = diffInDays(today, completedOn) > 0 ? today : completedOn;
  }
  return next;
}

/** Builds the synthetic demo cases relative to the given day. */
export function createSeedCases(today: ISODate): OnboardingCase[] {
  return SEED_DEFINITIONS.map((definition) => {
    const startDate = addDays(today, definition.startOffsetDays);
    const tasks = generateTasks(definition.id, startDate, definition.input.workflow).map((task) =>
      applySeedState(task, startDate, today, definition),
    );
    return {
      id: definition.id,
      ...definition.input,
      startDate,
      tasks,
      createdAt: `${addDays(today, definition.createdOffsetDays)}T09:00:00.000Z`,
    };
  });
}
