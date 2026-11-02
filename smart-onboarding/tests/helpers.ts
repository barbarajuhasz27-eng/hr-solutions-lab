import { addDays } from "@/lib/dates";
import type { OnboardingCase, OnboardingStage, OnboardingTask, TaskOwner, TaskStatus } from "@/types/onboarding";

export const TODAY = "2026-11-02";

type TaskSpec = {
  key: string;
  stage?: OnboardingStage;
  /** Due date relative to TODAY. */
  dueIn?: number;
  status?: TaskStatus;
  mandatory?: boolean;
  dependsOn?: string[];
  owner?: TaskOwner;
  completedAt?: string;
  blockedCount?: number;
  blockedReason?: string;
};

export function makeTask(spec: TaskSpec, caseId = "c"): OnboardingTask {
  const status = spec.status ?? "Not started";
  const dueDate = addDays(TODAY, spec.dueIn ?? 10);
  return {
    id: `${caseId}--${spec.key}`,
    templateKey: spec.key,
    title: `Task ${spec.key}`,
    description: "",
    owner: spec.owner ?? "HR",
    stage: spec.stage ?? "Pre-boarding",
    dueDate,
    status,
    mandatory: spec.mandatory ?? true,
    dependsOn: spec.dependsOn ?? [],
    blockedCount: spec.blockedCount ?? (status === "Blocked" ? 1 : 0),
    ...(spec.blockedReason ? { blockedReason: spec.blockedReason } : {}),
    ...(status === "Completed"
      ? { completedAt: spec.completedAt ?? ((spec.dueIn ?? 10) <= 0 ? dueDate : TODAY) }
      : {}),
  };
}

/** A small synthetic case; `startIn` is the start date relative to TODAY. */
export function makeCase(startIn: number, tasks: TaskSpec[], id = "c", name = "Test Person"): OnboardingCase {
  return {
    id,
    employeeName: name,
    jobTitle: "Analyst",
    department: "Operations",
    hiringManager: "Manager",
    location: "Remote",
    startDate: addDays(TODAY, startIn),
    employmentType: "Full-time",
    workflow: { workArrangement: "Office", peopleManager: false, internationalHire: false },
    contacts: {
      hrPartner: { name: "HR Partner", role: "People Partner" },
      buddy: { name: "Buddy Person", role: "Onboarding buddy" },
    },
    tasks: tasks.map((t) => makeTask(t, id)),
    createdAt: "2026-10-01T09:00:00.000Z",
  };
}
