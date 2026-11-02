import { addDays, diffInDays } from "@/lib/dates";
import { completionPercent, DUE_SOON_WINDOW_DAYS, isTaskComplete, isTaskOverdue, MILESTONES, sortTasksByDueDate } from "@/lib/metrics";
import type { ISODate, OnboardingCase, OnboardingStage, OnboardingTask, TaskOwner } from "@/types/onboarding";
import type { Meeting } from "@/types/feedback";

/*
 * Employee-facing view of an onboarding case.
 *
 * The portal reads the same case as the HR workspace but presents it for the new employee:
 * friendlier wording, no HR readiness classification and no internal blocker notes.
 */

/* ------------------------------------------------------------------ */
/* Wording                                                             */
/* ------------------------------------------------------------------ */

export const OWNER_LABEL_FOR_EMPLOYEE: Record<TaskOwner, string> = {
  "New employee": "You",
  HR: "HR",
  IT: "IT",
  "Finance / Payroll": "Payroll",
  Facilities: "Facilities",
  "Hiring manager": "Your manager",
  "HR + Hiring manager": "HR & your manager",
};

/** Employee-facing title and description per task template. Missing keys fall back to the task. */
const EMPLOYEE_COPY: Record<string, { title: string; description: string }> = {
  "employment-docs": {
    title: "HR prepares your onboarding documents",
    description: "HR gathers the documents you need for your start and lets you know if anything is missing.",
  },
  "new-hire-forms": {
    title: "Complete your new-hire forms",
    description: "Fill in the onboarding forms HR shared with you. Payroll setup starts once they are in.",
  },
  "payroll-setup": {
    title: "Payroll gets ready for your first pay cycle",
    description: "Payroll checks what is needed for your first salary payment.",
  },
  "account-provisioning": {
    title: "IT creates your user account",
    description: "Your company account and mailbox are created.",
  },
  equipment: {
    title: "IT prepares your laptop and equipment",
    description: "Your laptop and accessories are ordered and set up for your role.",
  },
  "system-access": {
    title: "IT sets up access to your tools",
    description: "You get access to the applications you need in your first weeks.",
  },
  buddy: {
    title: "Your onboarding buddy is confirmed",
    description: "A colleague is paired with you for everyday questions during your first weeks.",
  },
  "first-week-agenda": {
    title: "Your manager shares your first-week plan",
    description: "Key meetings, introductions and early goals for your first week.",
  },
  "welcome-orientation": {
    title: "Welcome meeting and company orientation",
    description: "Meet HR, get to know the organisation and the practical essentials.",
  },
  "team-intro": {
    title: "Meet your team",
    description: "Your manager introduces the team and walks through your role and ways of working.",
  },
  "confirm-access": {
    title: "Check your equipment and logins work",
    description: "IT makes sure you can sign in and use everything you need for the first week.",
  },
  "first-month-checkin": {
    title: "First-month conversation with your manager",
    description: "Look back on your first month together and agree priorities for the next one.",
  },
  "feedback-checkin": {
    title: "Onboarding feedback conversation with HR",
    description: "Tell HR how your onboarding is going and what could be better.",
  },
  "experience-survey": {
    title: "Share feedback on your onboarding (optional)",
    description: "A short, optional survey about your onboarding experience.",
  },
  "role-progress": {
    title: "Progress and support conversation",
    description: "Talk with your manager about how things are going and any support or training you need.",
  },
  "ninety-day-review": {
    title: "Your 90-day review",
    description: "Reflect on your first 90 days with HR and your manager and agree next steps.",
  },
  "desk-access": {
    title: "Facilities prepares your desk and building pass",
    description: "Your workspace and building access are arranged before you arrive.",
  },
  "office-tour": {
    title: "Office walkthrough",
    description: "A tour of the office, meeting rooms and shared spaces.",
  },
  "remote-guidelines": {
    title: "HR shares the remote-working guide",
    description: "How the team collaborates remotely, and where to find help.",
  },
  "equipment-delivery": {
    title: "Your equipment is delivered",
    description: "Your prepared laptop and accessories are delivered to you.",
  },
  "remote-setup-call": {
    title: "Remote IT setup call",
    description: "IT walks you through your first sign-in and the collaboration tools on a video call.",
  },
  "manager-handover": {
    title: "Your team handover briefing is prepared",
    description: "A summary of your team's context and open priorities, ready for your start.",
  },
  "manager-permissions": {
    title: "IT enables your manager tools",
    description: "Manager views and approval rights are switched on in internal tools.",
  },
  "direct-report-1on1s": {
    title: "Hold first 1:1s with your direct reports",
    description: "Meet each person in your team individually to get to know them.",
  },
  "manager-resources": {
    title: "HR shares manager development resources",
    description: "Guides and optional sessions to support you as a new manager.",
  },
  "intl-hr-review": {
    title: "HR reviews your relocation context",
    description: "HR reviews the practical context of your move and contacts you if anything is needed.",
  },
  "intl-hr-followup": {
    title: "HR follows up on open questions",
    description: "HR follows up on any open questions from the review.",
  },
  "intl-arrival-info": {
    title: "HR shares arrival information",
    description: "Practical information for your arrival, such as where to go on your first day.",
  },
};

/** What the new employee sees as a task's state. Internal blocker notes are never included. */
export type EmployeeTaskState = "Done" | "In progress" | "Not started" | "Delayed";

export type EmployeeTask = {
  id: string;
  templateKey: string;
  title: string;
  description: string;
  owner: TaskOwner;
  ownerLabel: string;
  stage: OnboardingStage;
  dueDate: ISODate;
  mandatory: boolean;
  /** Owned by the new employee (and therefore editable by them). */
  isOwn: boolean;
  state: EmployeeTaskState;
  /** The employee's own open task is past its due date. */
  pastDue: boolean;
  completedAt?: ISODate;
};

/**
 * Maps a task to the employee view. A stakeholder's task that is blocked, or mandatory and
 * overdue, is shown as "Delayed" without the internal reason. The employee's own tasks keep
 * their real status.
 */
export function toEmployeeTask(task: OnboardingTask, today: ISODate): EmployeeTask {
  const isOwn = task.owner === "New employee";
  const overdue = isTaskOverdue(task, today);
  let state: EmployeeTaskState;
  if (task.status === "Completed") state = "Done";
  else if (!isOwn && (task.status === "Blocked" || (overdue && task.mandatory))) state = "Delayed";
  else if (task.status === "In progress") state = "In progress";
  else state = "Not started";
  const copy = EMPLOYEE_COPY[task.templateKey];
  return {
    id: task.id,
    templateKey: task.templateKey,
    title: copy?.title ?? task.title,
    description: copy?.description ?? task.description,
    owner: task.owner,
    ownerLabel: OWNER_LABEL_FOR_EMPLOYEE[task.owner],
    stage: task.stage,
    dueDate: task.dueDate,
    mandatory: task.mandatory,
    isOwn,
    state,
    pastDue: isOwn && overdue,
    ...(task.completedAt ? { completedAt: task.completedAt } : {}),
  };
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/* ------------------------------------------------------------------ */
/* Where the employee is                                               */
/* ------------------------------------------------------------------ */

export type JourneyPosition =
  | { kind: "before-start"; daysUntilStart: number }
  | { kind: "first-day" }
  | { kind: "in-progress"; daysSinceStart: number; week: number }
  | { kind: "beyond-90"; daysSinceStart: number };

export function getJourneyPosition(onboarding: Pick<OnboardingCase, "startDate">, today: ISODate): JourneyPosition {
  const days = diffInDays(onboarding.startDate, today);
  if (days < 0) return { kind: "before-start", daysUntilStart: -days };
  if (days === 0) return { kind: "first-day" };
  if (days > 90) return { kind: "beyond-90", daysSinceStart: days };
  return { kind: "in-progress", daysSinceStart: days, week: Math.floor(days / 7) + 1 };
}

export type Checkpoint = { key: string; label: string; date: ISODate; daysAway: number };

/** The next Day 1 / 30 / 60 / 90 date on or after today, or null after Day 90. */
export function getNextCheckpoint(onboarding: Pick<OnboardingCase, "startDate">, today: ISODate): Checkpoint | null {
  for (const m of MILESTONES) {
    const date = addDays(onboarding.startDate, m.offsetDays);
    const daysAway = diffInDays(today, date);
    if (daysAway >= 0) return { key: m.key, label: m.label, date, daysAway };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Journey phases                                                      */
/* ------------------------------------------------------------------ */

export type PhaseState = "done" | "current" | "wrapping-up" | "upcoming";

export type JourneyPhase = {
  stage: OnboardingStage;
  label: string;
  summary: string;
  /** Date range relative to the start date: [from, to] in days. */
  fromDay: number;
  toDay: number;
  startDate: ISODate;
  endDate: ISODate;
  state: PhaseState;
  tasks: EmployeeTask[];
  done: number;
  total: number;
};

const PHASES: readonly { stage: OnboardingStage; label: string; summary: string; fromDay: number; toDay: number }[] = [
  { stage: "Pre-boarding", label: "Before you start", summary: "Your paperwork, equipment and access are prepared.", fromDay: -30, toDay: -1 },
  { stage: "Day 1", label: "Your first day", summary: "Welcome, team introductions and getting set up.", fromDay: 0, toDay: 0 },
  { stage: "First 30 days", label: "Your first month", summary: "Settle in, learn the role and share how it is going.", fromDay: 1, toDay: 30 },
  { stage: "Day 60", label: "Building momentum", summary: "Check progress and the support you need.", fromDay: 31, toDay: 60 },
  { stage: "Day 90", label: "Your 90-day review", summary: "Reflect together and agree your next steps.", fromDay: 61, toDay: 90 },
];

/**
 * Groups the case into five phases. A phase is "done" when all its mandatory steps are
 * completed (optional steps never hold a phase open, as with milestones), "current" when today
 * falls in its date range, "wrapping-up" when its dates have passed with mandatory steps still
 * open, and "upcoming" otherwise.
 */
export function getJourneyPhases(onboarding: OnboardingCase, today: ISODate): JourneyPhase[] {
  const day = diffInDays(onboarding.startDate, today);
  return PHASES.map((phase, index) => {
    const tasks = sortTasksByDueDate(onboarding.tasks.filter((t) => t.stage === phase.stage)).map((t) =>
      toEmployeeTask(t, today),
    );
    const done = tasks.filter((t) => t.state === "Done").length;
    const inRange = index === 0 ? day < 0 : day >= phase.fromDay && day <= phase.toDay;
    const passed = day > phase.toDay;
    const mandatory = tasks.filter((t) => t.mandatory);
    const mandatoryDone = mandatory.every((t) => t.state === "Done");
    let state: PhaseState;
    if (mandatoryDone && (mandatory.length > 0 || passed)) state = "done";
    else if (inRange) state = "current";
    else if (passed) state = "wrapping-up";
    else state = "upcoming";
    return {
      ...phase,
      startDate: addDays(onboarding.startDate, phase.fromDay),
      endDate: addDays(onboarding.startDate, phase.toDay),
      state,
      tasks,
      done,
      total: tasks.length,
    };
  });
}

/* ------------------------------------------------------------------ */
/* This week                                                           */
/* ------------------------------------------------------------------ */

export type WeekPlan = {
  /** Window: today up to and including today + 7 days. */
  from: ISODate;
  to: ISODate;
  /** The employee's own open tasks due in the window, or already past due. */
  yourTasks: EmployeeTask[];
  /** Other stakeholders' open tasks due in the window, plus mandatory ones already past due. Read-only. */
  teamTasks: EmployeeTask[];
  /** Tasks completed in the last 7 days. */
  recentlyDone: EmployeeTask[];
  /** When nothing is due this week: the next three open tasks after the window. */
  comingUp: EmployeeTask[];
};

export function getWeekPlan(onboarding: OnboardingCase, today: ISODate): WeekPlan {
  const to = addDays(today, DUE_SOON_WINDOW_DAYS);
  const sorted = sortTasksByDueDate(onboarding.tasks);
  const open = sorted.filter((t) => !isTaskComplete(t));
  const inWindow = (t: OnboardingTask) => diffInDays(today, t.dueDate) <= DUE_SOON_WINDOW_DAYS;

  const yourTasks = open.filter((t) => t.owner === "New employee" && inWindow(t));
  const teamTasks = open.filter(
    (t) => t.owner !== "New employee" && inWindow(t) && (t.mandatory || diffInDays(today, t.dueDate) >= 0),
  );
  const recentlyDone = sorted
    .filter((t) => t.completedAt && diffInDays(t.completedAt, today) <= 7 && diffInDays(t.completedAt, today) >= 0)
    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""));
  const comingUp =
    yourTasks.length === 0 && teamTasks.length === 0 ? open.filter((t) => !inWindow(t)).slice(0, 3) : [];

  const view = (list: OnboardingTask[]) => list.map((t) => toEmployeeTask(t, today));
  return {
    from: today,
    to,
    yourTasks: view(yourTasks),
    teamTasks: view(teamTasks),
    recentlyDone: view(recentlyDone),
    comingUp: view(comingUp),
  };
}

/* ------------------------------------------------------------------ */
/* Personal schedule                                                   */
/* ------------------------------------------------------------------ */

type EventSpec = { title: string; with: (c: OnboardingCase) => string };

/** Tasks that are meetings or sessions the employee attends. */
const SCHEDULE_EVENTS: Record<string, EventSpec> = {
  "welcome-orientation": { title: "Welcome & company orientation", with: (c) => c.contacts.hrPartner.name },
  "team-intro": { title: "Meet your team", with: (c) => c.hiringManager },
  "office-tour": { title: "Office walkthrough", with: () => "Facilities" },
  "remote-setup-call": { title: "Remote IT setup call", with: () => "IT" },
  "direct-report-1on1s": { title: "First 1:1s with your direct reports", with: () => "Your team" },
  "first-month-checkin": { title: "First-month conversation", with: (c) => c.hiringManager },
  "feedback-checkin": { title: "Onboarding feedback conversation", with: (c) => c.contacts.hrPartner.name },
  "role-progress": { title: "Progress and support conversation", with: (c) => c.hiringManager },
  "ninety-day-review": {
    title: "90-day review",
    with: (c) => `${c.contacts.hrPartner.name} & ${c.hiringManager}`,
  },
};

export type ScheduleEvent = {
  id: string;
  title: string;
  date: ISODate;
  with: string;
  done: boolean;
  /** Start time ("HH:MM") for booked check-ins. Other sessions are planned by date only. */
  time?: string;
};

export type Schedule = { upcoming: ScheduleEvent[]; past: ScheduleEvent[] };

/**
 * Meetings and sessions planned for the employee, taken from the case's tasks (dates only;
 * times are not planned in this prototype). The first day itself is always included.
 */
const CHECK_IN_TITLES: Record<Meeting["type"], string> = {
  hr: "HR check-in",
  manager: "Manager check-in",
  buddy: "Buddy chat",
};

export function getSchedule(onboarding: OnboardingCase, today: ISODate, meetings: readonly Meeting[] = []): Schedule {
  const events: ScheduleEvent[] = [
    {
      id: `${onboarding.id}--first-day`,
      title: "Your first day",
      date: onboarding.startDate,
      with: onboarding.location,
      done: diffInDays(onboarding.startDate, today) > 0,
    },
  ];
  for (const task of onboarding.tasks) {
    const spec = SCHEDULE_EVENTS[task.templateKey];
    if (!spec) continue;
    events.push({
      id: task.id,
      title: spec.title,
      date: task.dueDate,
      with: spec.with(onboarding),
      done: isTaskComplete(task),
    });
  }
  // Check-ins the employee booked (cancelled ones are left out).
  for (const m of meetings) {
    if (m.caseId !== onboarding.id || m.status === "cancelled") continue;
    events.push({
      id: m.id,
      title: CHECK_IN_TITLES[m.type],
      date: m.date,
      time: m.time,
      with: m.hostName,
      done: m.status === "completed",
    });
  }
  // Stable sort by date: the first day comes first, then sessions in workflow order.
  events.sort((a, b) => a.date.localeCompare(b.date));
  return {
    upcoming: events.filter((e) => !e.done && diffInDays(today, e.date) >= 0),
    past: events.filter((e) => e.done || diffInDays(today, e.date) < 0).reverse(),
  };
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export type PortalContact = {
  kind: "manager" | "hr" | "buddy";
  name: string;
  role: string;
  helpsWith: string;
  /** False while the introduction is still being arranged. */
  introduced: boolean;
};

export function getContacts(onboarding: OnboardingCase): PortalContact[] {
  const buddyTask = onboarding.tasks.find((t) => t.templateKey === "buddy");
  return [
    {
      kind: "manager",
      name: onboarding.hiringManager,
      role: "Your manager",
      helpsWith: "Your role, priorities and goals",
      introduced: true,
    },
    {
      kind: "hr",
      name: onboarding.contacts.hrPartner.name,
      role: onboarding.contacts.hrPartner.role,
      helpsWith: "Onboarding, policies, contracts and wellbeing",
      introduced: true,
    },
    {
      kind: "buddy",
      name: onboarding.contacts.buddy.name,
      role: onboarding.contacts.buddy.role,
      helpsWith: "Everyday questions and finding your way around",
      introduced: !buddyTask || isTaskComplete(buddyTask),
    },
  ];
}

/* ------------------------------------------------------------------ */
/* Progress                                                            */
/* ------------------------------------------------------------------ */

export type PortalProgress = {
  overallPercent: number;
  done: number;
  total: number;
  ownDone: number;
  ownTotal: number;
};

export function getPortalProgress(onboarding: OnboardingCase): PortalProgress {
  const own = onboarding.tasks.filter((t) => t.owner === "New employee");
  return {
    overallPercent: completionPercent(onboarding.tasks),
    done: onboarding.tasks.filter(isTaskComplete).length,
    total: onboarding.tasks.length,
    ownDone: own.filter(isTaskComplete).length,
    ownTotal: own.length,
  };
}
