import type { Activity, ActionInstance } from "./model";
import { getPlaybook, PLAYBOOKS } from "./playbooks";

function instantiateActions(playbookId: string, startsAt: Date): ActionInstance[] {
  const playbook = getPlaybook(playbookId);
  if (!playbook) return [];

  return playbook.actions.map((action) => ({
    ...action,
    status: "not-started",
    ownerName:
      action.ownerRole === "Facilities"
        ? "Mara Klein"
        : action.ownerRole === "IT"
          ? "Jonas Weber"
          : action.ownerRole === "Trainer"
            ? "Alex Morgan"
            : action.ownerRole.includes("Trainer")
              ? "Alex Morgan"
              : "Sophie Lang",
  }));
}

export function createActivity(
  playbookId: string,
  title: string,
  startsAt: Date,
  id: string,
  options?: { location?: string; coordinator?: string; complete?: boolean },
): Activity {
  const actions = instantiateActions(playbookId, startsAt);
  const completedAt = options?.complete ? new Date(startsAt.getTime() + 90 * 60_000).toISOString() : undefined;
  const activity: Activity = {
    id,
    title,
    playbookId,
    startsAt: startsAt.toISOString(),
    coordinator: options?.coordinator ?? "Sophie Lang",
    location: options?.location ?? "Meeting room / hybrid",
    actions,
    ...(completedAt ? { completedAt } : {}),
  };

  if (options?.complete) {
    activity.actions = activity.actions.map((action) => ({
      ...action,
      status: "done",
    }));
  }

  return activity;
}

export function createSeedActivities(now: Date): Activity[] {
  const training = getPlaybook("training-session");
  const rescueStart = new Date(now.getTime() + 45 * 60_000);
  const rescue = createActivity(
    "training-session",
    "Leading through change",
    rescueStart,
    "activity-training-rescue",
    { location: "Room 2.14 · HQ" },
  );

  const performanceStart = new Date(now.getTime() + 6 * 24 * 60 * 60_000);
  const performance = createActivity(
    "performance-cycle",
    "Performance review cycle launch",
    performanceStart,
    "activity-performance-cycle",
    { location: "All departments · hybrid" },
  );

  const informationStart = new Date(now.getTime() + 3 * 24 * 60 * 60_000);
  const info = createActivity(
    "employee-info-session",
    "New benefits information session",
    informationStart,
    "activity-benefits-session",
    { location: "Virtual · Teams" },
  );

  const monthlyStart = new Date(now.getTime() + 2 * 24 * 60 * 60_000);
  const monthly = createActivity(
    "monthly-operations",
    "Monthly HR data hand-off",
    monthlyStart,
    "activity-monthly-operations",
    { location: "HR / Payroll" },
  );

  const completedStart = new Date(now.getTime() - 5 * 24 * 60 * 60_000);
  const completed = createActivity(
    "training-session",
    "Excel essentials for managers",
    completedStart,
    "activity-training-complete",
    { location: "Training room · HQ", complete: true },
  );

  // Keep the unused variable explicit: the seeded training scenario is the only
  // fully populated playbook in the first vertical slice.
  void training;
  return [rescue, monthly, info, performance, completed];
}

export function resetActivities(now: Date): Activity[] {
  return createSeedActivities(now);
}

export function getPlayablePlaybooks() {
  return PLAYBOOKS.filter((playbook) => playbook.actions.length > 0);
}
