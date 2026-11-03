import type { Activity, ActionInstance } from "./model";
import { getPlaybook } from "./playbooks";

function instantiateActions(playbookId: string): ActionInstance[] {
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
  const actions = instantiateActions(playbookId);
  const completedAt = options?.complete
    ? new Date(startsAt.getTime() + 90 * 60_000).toISOString()
    : undefined;
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
  const rescueStart = new Date(now.getTime() + 45 * 60_000);
  const rescue = createActivity(
    "training-session",
    "Leading through change",
    rescueStart,
    "activity-training-rescue",
    { location: "Room 2.14 · HQ" },
  );

  const plannedStart = new Date(now.getTime() + 4 * 24 * 60 * 60_000);
  const planned = createActivity(
    "training-session",
    "Excel essentials for managers",
    plannedStart,
    "activity-training-upcoming",
    { location: "Training room · HQ" },
  );
  planned.actions = planned.actions.map((action) =>
    ["trainer-confirmed", "participants-confirmed", "room-confirmed"].includes(action.id)
      ? { ...action, status: "done", statusNote: "Confirmed in the demo workspace." }
      : action,
  );

  const completedStart = new Date(now.getTime() - 5 * 24 * 60 * 60_000);
  const completed = createActivity(
    "training-session",
    "HR systems refresher",
    completedStart,
    "activity-training-complete",
    { location: "Virtual · Teams", complete: true },
  );

  return [rescue, planned, completed];
}

export function resetActivities(now: Date): Activity[] {
  return createSeedActivities(now);
}
