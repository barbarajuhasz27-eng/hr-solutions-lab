import type { OnboardingCase, OnboardingTask, TaskStatus } from "@/types/onboarding";

/*
 * Simulated access rules for the demo previews.
 *
 * IMPORTANT: this prototype has no authentication. The two previews are a demonstration of
 * how the product would separate employee and HR views. All data lives in one browser's
 * localStorage, and anyone using the browser can switch previews or read the data. These
 * rules shape what each preview shows and allows; they are not a security boundary.
 */

export const PREVIEW_ROLES = ["new-hire", "hr"] as const;
export type PreviewRole = (typeof PREVIEW_ROLES)[number];

export const PREVIEW_ROLE_LABEL: Record<PreviewRole, string> = {
  "new-hire": "New Hire",
  hr: "HR",
};

/** Who is looking: HR sees the whole workspace; a new hire sees only their own case. */
export type Viewer = { role: "hr" } | { role: "new-hire"; caseId: string };

/** Statuses a new hire can set on their own tasks. Blocking is an HR/owner decision. */
export const EMPLOYEE_SETTABLE_STATUSES: readonly TaskStatus[] = ["Not started", "In progress", "Completed"];

export function canViewCase(viewer: Viewer, onboarding: Pick<OnboardingCase, "id">): boolean {
  return viewer.role === "hr" || viewer.caseId === onboarding.id;
}

/**
 * HR can update every task. A new hire can update only tasks in their own case that are
 * owned by "New employee"; tasks owned by other stakeholders are visible but read-only.
 */
export function canEditTask(
  viewer: Viewer,
  onboarding: Pick<OnboardingCase, "id">,
  task: Pick<OnboardingTask, "owner">,
): boolean {
  if (viewer.role === "hr") return true;
  return viewer.caseId === onboarding.id && task.owner === "New employee";
}

export function canSetTaskStatus(
  viewer: Viewer,
  onboarding: Pick<OnboardingCase, "id">,
  task: Pick<OnboardingTask, "owner">,
  status: TaskStatus,
): boolean {
  if (!canEditTask(viewer, onboarding, task)) return false;
  return viewer.role === "hr" || EMPLOYEE_SETTABLE_STATUSES.includes(status);
}

/**
 * Learning progress (lessons viewed, quiz attempts) is recorded only by the new hire who owns
 * the assignment. HR can see progress but cannot complete learning on someone's behalf.
 */
export function canUpdateLearning(viewer: Viewer, assignment: { caseId: string }): boolean {
  return viewer.role === "new-hire" && viewer.caseId === assignment.caseId;
}

/* ------------------------------------------------------------------ */
/* Feedback, check-ins and action plans (simulated roles only)         */
/* ------------------------------------------------------------------ */

function isOwnCase(viewer: Viewer, caseId: string): boolean {
  return viewer.role === "new-hire" && viewer.caseId === caseId;
}

/** Surveys, topic consent, booking and follow-ups are the employee's own decisions. */
export function canGiveFeedback(viewer: Viewer, caseId: string): boolean {
  return isOwnCase(viewer, caseId);
}

/** Booking and cancelling: the employee for their own check-ins; HR can cancel on request. */
export function canCancelMeeting(viewer: Viewer, caseId: string): boolean {
  return viewer.role === "hr" || isOwnCase(viewer, caseId);
}

/** Shared agenda points can be added by the employee and by HR (acting for the meeting host). */
export function canAddAgendaPoint(viewer: Viewer, caseId: string): boolean {
  return viewer.role === "hr" || isOwnCase(viewer, caseId);
}

/** Recording the agreed outcome, HR-only notes and creating actions is done in the HR workspace. */
export function canManageCheckIns(viewer: Viewer): boolean {
  return viewer.role === "hr";
}

/** HR can update any action; the employee can update actions they own. */
export function canSetActionStatus(viewer: Viewer, action: { caseId: string; owner: string }): boolean {
  return viewer.role === "hr" || (isOwnCase(viewer, action.caseId) && action.owner === "Employee");
}

/**
 * Confidential survey answers: the employee sees their own; HR sees them only after an explicit
 * "show" step on the case page. They never appear in shared agendas, actions or overviews.
 * This is a simulated rule in a prototype without sign-in; it is not real access control.
 */
export function canViewConfidentialFeedback(viewer: Viewer, caseId: string): boolean {
  return viewer.role === "hr" || isOwnCase(viewer, caseId);
}

/* ------------------------------------------------------------------ */
/* Workspace areas                                                     */
/* ------------------------------------------------------------------ */

export type WorkspaceArea = "portal" | "hr";

const HR_PATH_PREFIXES = ["/readiness", "/insights", "/experience", "/learning", "/check-ins", "/tasks", "/onboarding"];

/**
 * The area a path belongs to. "/" is shared: it shows the portal home or the HR dashboard
 * depending on the preview, so it returns null. Unknown paths also return null.
 */
export function areaForPath(pathname: string): WorkspaceArea | null {
  if (pathname === "/me" || pathname.startsWith("/me/")) return "portal";
  if (HR_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return "hr";
  return null;
}

export function areaForRole(role: PreviewRole): WorkspaceArea {
  return role === "hr" ? "hr" : "portal";
}
