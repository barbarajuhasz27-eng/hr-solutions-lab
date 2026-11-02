import {
  canAddAgendaPoint,
  canCancelMeeting,
  canGiveFeedback,
  canManageCheckIns,
  canSetActionStatus,
  canSetTaskStatus,
  canUpdateLearning,
  type Viewer,
} from "@/lib/access";
import { defaultContacts } from "@/lib/contacts";
import { isValidISODate, todayISO } from "@/lib/dates";
import { markLessonViewed, reconcileAssignments, recordQuizAttempt } from "@/lib/learning";
import { createSeedLearning } from "@/lib/learning-seed";
import * as fx from "@/lib/feedback";
import { createSeedFeedback } from "@/lib/feedback-seed";
import { createSeedCases } from "@/lib/seed-data";
import { DEFAULT_WORKFLOW, findTemplate, generateTasks } from "@/lib/workflow-templates";
import {
  EMPLOYMENT_TYPES,
  ONBOARDING_STAGES,
  TASK_OWNERS,
  TASK_STATUSES,
  WORK_ARRANGEMENTS,
  type CaseContacts,
  type ISODate,
  type NewOnboardingInput,
  type OnboardingCase,
  type OnboardingTask,
  type TaskStatus,
} from "@/types/onboarding";
import { LEARNING_CHECKPOINTS, LEARNING_MODULE_IDS, type LearningAssignment } from "@/types/learning";
import {
  ACTION_EVENT_TYPES,
  ACTION_OWNERS,
  ACTION_STATUSES,
  AGENDA_SOURCES,
  FEEDBACK_AREAS,
  FOLLOW_UP_RESPONSES,
  MEETING_STATUSES,
  MEETING_TYPES,
  SURVEY_CHECKPOINTS,
  TOPIC_STATUSES,
  type ActionStatus,
  type FeedbackArea,
  type FeedbackState,
  type FollowUpResponse,
  type Meeting,
  type MeetingType,
  type SurveyCheckpoint,
} from "@/types/feedback";

export const STORAGE_KEY = "smart-onboarding:workspace";
export const SCHEMA_VERSION = 3;

type PersistedState = {
  version: number;
  cases: OnboardingCase[];
  /** Optional, additive collection (Learning Center). Absent in data saved before it existed. */
  learning?: LearningAssignment[];
  /** Optional, additive collection (feedback, check-ins and action plans). */
  feedback?: FeedbackState;
};

/**
 * Where the loaded data came from. "migrated" means version 1 data was upgraded;
 * "migrated" also covers version 2 data upgraded to version 3, and version 3 data whose
 * missing contacts were filled in. "recovered" means stored data was unusable and demo
 * data was restored.
 */
export type LoadSource = "stored" | "migrated" | "seed" | "recovered";

/* ------------------------------------------------------------------ */
/* Migration from schema version 1                                     */
/* ------------------------------------------------------------------ */

const V1_KEY_RENAMES: Record<string, string> = { accounts: "system-access" };

/**
 * Upgrades version 1 cases (single checklist, no dependencies) to the current schema.
 * Existing tasks and statuses are preserved; each task picks up the mandatory flag and
 * dependencies of its template, limited to tasks that exist in the case. Cases default
 * to the Office workflow. Missing new tasks are not added, so existing progress is kept as is.
 */
export function migrateV1Cases(cases: unknown[]): OnboardingCase[] {
  return cases.map((value) => {
    const c = (value ?? {}) as Record<string, unknown>;
    const rawTasks = Array.isArray(c.tasks) ? (c.tasks as Record<string, unknown>[]) : [];
    const tasks = rawTasks.map((t) => {
      const key = String(t.templateKey ?? "");
      const templateKey = V1_KEY_RENAMES[key] ?? key;
      const template = findTemplate(templateKey);
      return {
        ...t,
        templateKey,
        mandatory: template?.mandatory ?? true,
        dependsOn: template?.dependsOn ?? [],
        blockedCount: t.status === "Blocked" ? 1 : 0,
      } as unknown as OnboardingTask;
    });
    const keys = new Set(tasks.map((t) => t.templateKey));
    return withContacts({
      ...c,
      workflow: { ...DEFAULT_WORKFLOW },
      tasks: tasks.map((t) => ({ ...t, dependsOn: t.dependsOn.filter((k) => keys.has(k)) })),
    });
  });
}

/* ------------------------------------------------------------------ */
/* Migration from schema version 2                                     */
/* ------------------------------------------------------------------ */

/**
 * Adds default support contacts when a case has none. Tasks, statuses and every other
 * field are left untouched. Contacts that are present (valid or not) are never replaced,
 * so invalid data is still caught by validation.
 */
function withContacts(value: unknown): OnboardingCase {
  const c = (value ?? {}) as Record<string, unknown>;
  if (c.contacts !== undefined) return c as unknown as OnboardingCase;
  const id = typeof c.id === "string" ? c.id : "";
  const department = typeof c.department === "string" ? c.department : "";
  return { ...c, contacts: defaultContacts(id, department) } as unknown as OnboardingCase;
}

/** Upgrades version 2 cases to version 3 by adding support contacts. */
export function migrateV2Cases(cases: unknown[]): OnboardingCase[] {
  return cases.map(withContacts);
}

/* ------------------------------------------------------------------ */
/* Validation of persisted data                                        */
/* ------------------------------------------------------------------ */

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

export function isOnboardingTask(value: unknown): value is OnboardingTask {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    isNonEmptyString(t.id) &&
    isNonEmptyString(t.templateKey) &&
    isNonEmptyString(t.title) &&
    typeof t.description === "string" &&
    isOneOf(TASK_OWNERS, t.owner) &&
    isOneOf(ONBOARDING_STAGES, t.stage) &&
    isValidISODate(t.dueDate) &&
    isOneOf(TASK_STATUSES, t.status) &&
    (t.completedAt === undefined || isValidISODate(t.completedAt)) &&
    typeof t.mandatory === "boolean" &&
    Array.isArray(t.dependsOn) &&
    t.dependsOn.every((d) => typeof d === "string") &&
    typeof t.blockedCount === "number" &&
    t.blockedCount >= 0 &&
    (t.blockedReason === undefined || typeof t.blockedReason === "string")
  );
}

function isWorkflowContext(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const w = value as Record<string, unknown>;
  return (
    isOneOf(WORK_ARRANGEMENTS, w.workArrangement) &&
    typeof w.peopleManager === "boolean" &&
    typeof w.internationalHire === "boolean"
  );
}

function isSupportContact(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const p = value as Record<string, unknown>;
  return isNonEmptyString(p.name) && isNonEmptyString(p.role);
}

function isCaseContacts(value: unknown): value is CaseContacts {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return isSupportContact(c.hrPartner) && isSupportContact(c.buddy);
}

export function isOnboardingCase(value: unknown): value is OnboardingCase {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    isNonEmptyString(c.id) &&
    isNonEmptyString(c.employeeName) &&
    isNonEmptyString(c.jobTitle) &&
    isNonEmptyString(c.department) &&
    isNonEmptyString(c.hiringManager) &&
    isNonEmptyString(c.location) &&
    isValidISODate(c.startDate) &&
    isOneOf(EMPLOYMENT_TYPES, c.employmentType) &&
    isWorkflowContext(c.workflow) &&
    isCaseContacts(c.contacts) &&
    typeof c.createdAt === "string" &&
    Array.isArray(c.tasks) &&
    c.tasks.every(isOnboardingTask)
  );
}

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

function isQuizResult(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    isValidISODate(r.attemptedAt) &&
    typeof r.answers === "object" &&
    r.answers !== null &&
    Object.values(r.answers).every((v) => typeof v === "string") &&
    typeof r.correct === "number" &&
    typeof r.total === "number" &&
    typeof r.score === "number" &&
    typeof r.passed === "boolean"
  );
}

export function isLearningAssignment(value: unknown): value is LearningAssignment {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;
  return (
    isNonEmptyString(a.id) &&
    isNonEmptyString(a.caseId) &&
    isOneOf(LEARNING_MODULE_IDS, a.moduleId) &&
    typeof a.mandatory === "boolean" &&
    isOneOf(LEARNING_CHECKPOINTS, a.checkpoint) &&
    isValidISODate(a.dueDate) &&
    Array.isArray(a.viewedLessonIds) &&
    a.viewedLessonIds.every((id) => typeof id === "string") &&
    Array.isArray(a.quizResults) &&
    a.quizResults.every(isQuizResult) &&
    (a.completedAt === undefined || isValidISODate(a.completedAt))
  );
}

const isOptionalString = (v: unknown) => v === undefined || typeof v === "string";
const isOptionalDate = (v: unknown) => v === undefined || isValidISODate(v);
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;

function isSurveyResponse(v: unknown): boolean {
  if (!isObject(v) || !isObject(v.ratings)) return false;
  const ratings = v.ratings;
  return (
    isNonEmptyString(v.id) &&
    isNonEmptyString(v.caseId) &&
    isOneOf(SURVEY_CHECKPOINTS, v.checkpoint) &&
    isValidISODate(v.submittedAt) &&
    FEEDBACK_AREAS.every((a) => fx.isRating(ratings[a])) &&
    isOptionalString(v.comment)
  );
}

function isTopic(v: unknown): boolean {
  return (
    isObject(v) &&
    isNonEmptyString(v.id) &&
    isNonEmptyString(v.caseId) &&
    isNonEmptyString(v.responseId) &&
    isOneOf(SURVEY_CHECKPOINTS, v.checkpoint) &&
    isOneOf(FEEDBACK_AREAS, v.area) &&
    isOneOf(TOPIC_STATUSES, v.status) &&
    isValidISODate(v.createdAt) &&
    isOptionalDate(v.reviewedAt) &&
    isOptionalString(v.employeeNote)
  );
}

function isAgendaItem(v: unknown): boolean {
  return (
    isObject(v) &&
    isNonEmptyString(v.id) &&
    isOneOf(AGENDA_SOURCES, v.source) &&
    typeof v.text === "string" &&
    typeof v.addedBy === "string" &&
    isOptionalString(v.topicId)
  );
}

function isMeeting(v: unknown): boolean {
  return (
    isObject(v) &&
    isNonEmptyString(v.id) &&
    isNonEmptyString(v.caseId) &&
    isOneOf(MEETING_TYPES, v.type) &&
    isNonEmptyString(v.slotId) &&
    isNonEmptyString(v.hostName) &&
    isValidISODate(v.date) &&
    typeof v.time === "string" &&
    /^\d{2}:\d{2}$/.test(v.time) &&
    typeof v.durationMinutes === "number" &&
    isOneOf(MEETING_STATUSES, v.status) &&
    isValidISODate(v.bookedAt) &&
    Array.isArray(v.agenda) &&
    v.agenda.every(isAgendaItem) &&
    isOptionalString(v.outcome) &&
    isOptionalDate(v.completedAt) &&
    isOptionalDate(v.cancelledAt) &&
    isOptionalString(v.hrNote)
  );
}

function isActionSource(v: unknown): boolean {
  if (!isObject(v)) return false;
  return (v.kind === "meeting" && isNonEmptyString(v.meetingId)) || (v.kind === "topic" && isNonEmptyString(v.topicId));
}

function isActionItem(v: unknown): boolean {
  return (
    isObject(v) &&
    isNonEmptyString(v.id) &&
    isNonEmptyString(v.caseId) &&
    isNonEmptyString(v.description) &&
    isOneOf(ACTION_OWNERS, v.owner) &&
    isValidISODate(v.dueDate) &&
    isOneOf(ACTION_STATUSES, v.status) &&
    isActionSource(v.source) &&
    isOptionalString(v.linkedTaskId) &&
    isValidISODate(v.createdAt) &&
    isOptionalDate(v.completedAt) &&
    typeof v.reopenCount === "number" &&
    Array.isArray(v.followUps) &&
    v.followUps.every((u) => isObject(u) && isValidISODate(u.at) && isOneOf(FOLLOW_UP_RESPONSES, u.response)) &&
    Array.isArray(v.history) &&
    v.history.every(
      (e) => isObject(e) && isValidISODate(e.at) && isOneOf(ACTION_EVENT_TYPES, e.type) && typeof e.detail === "string" && typeof e.by === "string",
    )
  );
}

export function isFeedbackState(value: unknown): value is FeedbackState {
  return (
    isObject(value) &&
    Array.isArray(value.responses) &&
    value.responses.every(isSurveyResponse) &&
    Array.isArray(value.topics) &&
    value.topics.every(isTopic) &&
    Array.isArray(value.meetings) &&
    value.meetings.every(isMeeting) &&
    Array.isArray(value.actions) &&
    value.actions.every(isActionItem)
  );
}

function readRaw(storage: Storage | undefined): string | null {
  try {
    return storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
}

function parseCases(
  raw: string | null,
  today: ISODate,
): { cases: OnboardingCase[]; source: LoadSource; parsed: Partial<PersistedState> | null } {
  if (raw === null) return { cases: createSeedCases(today), source: "seed", parsed: null };

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    if (parsed && parsed.version === 1 && Array.isArray(parsed.cases)) {
      const migrated = migrateV1Cases(parsed.cases);
      if (migrated.every(isOnboardingCase)) return { cases: migrated, source: "migrated", parsed };
    }
    if (parsed && parsed.version === 2 && Array.isArray(parsed.cases)) {
      const migrated = migrateV2Cases(parsed.cases);
      if (migrated.every(isOnboardingCase)) return { cases: migrated, source: "migrated", parsed };
    }
    if (parsed && parsed.version === SCHEMA_VERSION && Array.isArray(parsed.cases)) {
      if (parsed.cases.every(isOnboardingCase)) return { cases: parsed.cases, source: "stored", parsed };
      // Repair cases that only lack contacts; anything else invalid falls through to recovery.
      const repaired = migrateV2Cases(parsed.cases);
      if (repaired.every(isOnboardingCase)) return { cases: repaired, source: "migrated", parsed };
    }
  } catch {
    // fall through to recovery
  }
  return { cases: createSeedCases(today), source: "recovered", parsed: null };
}

/**
 * Reads cases from storage. Missing, malformed or outdated data is replaced by the
 * synthetic demo data so the app always starts in a usable state.
 */
export function loadCases(
  storage: Storage | undefined,
  today: ISODate,
): { cases: OnboardingCase[]; source: LoadSource } {
  const { cases, source } = parseCases(readRaw(storage), today);
  return { cases, source };
}

/**
 * Where learning assignments came from: "stored" (read from storage and reconciled with the
 * cases), "generated" (no learning data was saved yet, e.g. data from before the Learning
 * Center) or "recovered" (saved learning data was invalid and was rebuilt; cases are kept).
 */
export type LearningLoadSource = "stored" | "generated" | "recovered";

export type Workspace = { cases: OnboardingCase[]; learning: LearningAssignment[]; feedback: FeedbackState };

/** Same meaning as LearningLoadSource, for the feedback collection. */
export type FeedbackLoadSource = LearningLoadSource;

/**
 * Reads the whole workspace. Learning is an optional, additive collection in the v3 envelope:
 * data saved before it existed loads unchanged and gets learning assignments from each case's
 * path (demo cases with their synthetic progress). Invalid learning data never discards cases.
 */
export function loadWorkspace(
  storage: Storage | undefined,
  today: ISODate,
): Workspace & {
  source: LoadSource;
  learningSource: LearningLoadSource;
  feedbackSource: FeedbackLoadSource;
  needsSave: boolean;
} {
  const { cases, source, parsed } = parseCases(readRaw(storage), today);
  const fresh = source === "seed" || source === "recovered";
  const storedLearning = fresh ? undefined : parsed?.learning;
  const storedFeedback = fresh ? undefined : parsed?.feedback;

  let learning: LearningAssignment[];
  let learningSource: LearningLoadSource;
  if (Array.isArray(storedLearning) && storedLearning.every(isLearningAssignment)) {
    learning = reconcileAssignments(cases, storedLearning);
    learningSource = "stored";
  } else {
    learning = createSeedLearning(cases, today);
    learningSource = storedLearning === undefined ? "generated" : "recovered";
  }

  // Feedback is never invented for existing data: data saved before this feature gets the
  // synthetic demo feedback only for demo cases (seed ids); other cases start empty.
  let feedback: FeedbackState;
  let feedbackSource: FeedbackLoadSource;
  if (isFeedbackState(storedFeedback)) {
    feedback = fx.reconcileFeedback(cases, storedFeedback);
    feedbackSource = "stored";
  } else {
    feedback = createSeedFeedback(cases, today);
    feedbackSource = storedFeedback === undefined ? "generated" : "recovered";
  }

  const needsSave =
    source !== "stored" ||
    learningSource !== "stored" ||
    learning !== storedLearning ||
    feedbackSource !== "stored" ||
    feedback !== storedFeedback;
  return { cases, learning, feedback, source, learningSource, feedbackSource, needsSave };
}

export function saveCases(
  storage: Storage | undefined,
  cases: OnboardingCase[],
  learning?: LearningAssignment[],
  feedback?: FeedbackState,
): void {
  try {
    const state: PersistedState = {
      version: SCHEMA_VERSION,
      cases,
      ...(learning ? { learning } : {}),
      ...(feedback ? { feedback } : {}),
    };
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be full or unavailable (e.g. private mode); the in-memory state still works.
  }
}

/* ------------------------------------------------------------------ */
/* Pure state transitions                                              */
/* ------------------------------------------------------------------ */

export function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `case-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Creates a new onboarding case with the default task checklist. */
export function createCase(
  input: NewOnboardingInput,
  options: { id?: string; now?: Date } = {},
): OnboardingCase {
  const id = options.id ?? createId();
  const now = options.now ?? new Date();
  return {
    id,
    ...input,
    contacts: input.contacts ?? defaultContacts(id, input.department),
    tasks: generateTasks(id, input.startDate, input.workflow),
    createdAt: now.toISOString(),
  };
}

export function updateTaskStatus(
  cases: readonly OnboardingCase[],
  caseId: string,
  taskId: string,
  status: TaskStatus,
  today: ISODate,
): OnboardingCase[] {
  return cases.map((c) => {
    if (c.id !== caseId) return c;
    return {
      ...c,
      tasks: c.tasks.map((task) => {
        if (task.id !== taskId || task.status === status) return task;
        if (status === "Completed") return { ...task, status, completedAt: today };
        const { completedAt: _completedAt, ...rest } = task;
        void _completedAt;
        // Count each move into Blocked so recurring blockers stay visible after resolution.
        const blockedCount = status === "Blocked" ? task.blockedCount + 1 : task.blockedCount;
        return { ...rest, status, blockedCount };
      }),
    };
  });
}

/**
 * Status change made by a viewer. The change is applied only when the access rules allow it
 * (see lib/access.ts); otherwise the cases are returned unchanged.
 */
export function updateTaskStatusAs(
  viewer: Viewer,
  cases: readonly OnboardingCase[],
  caseId: string,
  taskId: string,
  status: TaskStatus,
  today: ISODate,
): OnboardingCase[] {
  const onboarding = cases.find((c) => c.id === caseId);
  const task = onboarding?.tasks.find((t) => t.id === taskId);
  if (!onboarding || !task || !canSetTaskStatus(viewer, onboarding, task, status)) return [...cases];
  return updateTaskStatus(cases, caseId, taskId, status, today);
}

export function removeCase(cases: readonly OnboardingCase[], caseId: string): OnboardingCase[] {
  return cases.filter((c) => c.id !== caseId);
}

/* ------------------------------------------------------------------ */
/* Client-side external store (used with useSyncExternalStore)         */
/* ------------------------------------------------------------------ */

/**
 * Learning progress update made by a viewer. Only the new hire who owns the assignment can
 * record their own progress; otherwise the assignments are returned unchanged.
 */
export function updateLearningAs(
  viewer: Viewer,
  learning: readonly LearningAssignment[],
  assignmentId: string,
  update: (assignments: readonly LearningAssignment[]) => LearningAssignment[],
): LearningAssignment[] {
  const assignment = learning.find((a) => a.id === assignmentId);
  if (!assignment || !canUpdateLearning(viewer, assignment)) return learning as LearningAssignment[];
  return update(learning);
}

type Listener = () => void;

let state: Workspace | null = null;
const listeners = new Set<Listener>();

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function ensureState(): Workspace {
  if (state === null) {
    const loaded = loadWorkspace(browserStorage(), todayISO());
    state = { cases: loaded.cases, learning: loaded.learning, feedback: loaded.feedback };
    if (loaded.needsSave) saveCases(browserStorage(), state.cases, state.learning, state.feedback);
  }
  return state;
}

function setWorkspace(next: Workspace) {
  state = next;
  saveCases(browserStorage(), next.cases, next.learning, next.feedback);
  emit();
}

/** Updates cases and keeps learning assignments in line (new cases get paths, deleted ones lose them). */
function setState(cases: OnboardingCase[]) {
  const current = ensureState();
  setWorkspace({
    cases,
    learning: reconcileAssignments(cases, current.learning),
    feedback: fx.reconcileFeedback(cases, current.feedback),
  });
}

function setLearning(learning: LearningAssignment[]) {
  const current = ensureState();
  if (learning !== current.learning) setWorkspace({ ...current, learning });
}

function setFeedback(feedback: FeedbackState) {
  const current = ensureState();
  if (feedback !== current.feedback) setWorkspace({ ...current, feedback });
}

function findCase(caseId: string): OnboardingCase | undefined {
  return ensureState().cases.find((c) => c.id === caseId);
}

function byLabel(viewer: Viewer): string {
  return viewer.role === "hr" ? "HR" : "Employee";
}

export const onboardingStore = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    const onStorage = (event: StorageEvent) => {
      // Keep several open tabs in sync.
      if (event.key === STORAGE_KEY) {
        const loaded = loadWorkspace(browserStorage(), todayISO());
        state = { cases: loaded.cases, learning: loaded.learning, feedback: loaded.feedback };
        emit();
      }
    };
    if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
    };
  },

  getSnapshot(): OnboardingCase[] {
    return ensureState().cases;
  },

  getLearningSnapshot(): LearningAssignment[] {
    return ensureState().learning;
  },

  getLearningServerSnapshot(): LearningAssignment[] | null {
    return null;
  },

  /** Marks a lesson as viewed for the new hire who owns the assignment. */
  viewLesson(viewer: Viewer, assignmentId: string, lessonId: string) {
    const current = ensureState().learning;
    setLearning(
      updateLearningAs(viewer, current, assignmentId, (l) => markLessonViewed(l, assignmentId, lessonId, todayISO())),
    );
  },

  /** Records a quiz attempt for the new hire who owns the assignment. */
  submitQuiz(viewer: Viewer, assignmentId: string, answers: Record<string, string>) {
    const current = ensureState().learning;
    setLearning(
      updateLearningAs(viewer, current, assignmentId, (l) => recordQuizAttempt(l, assignmentId, answers, todayISO())),
    );
  },

  getFeedbackSnapshot(): FeedbackState {
    return ensureState().feedback;
  },

  getFeedbackServerSnapshot(): FeedbackState | null {
    return null;
  },

  /* Feedback, check-ins and action plans. Every action checks the simulated viewer. */

  submitSurvey(
    viewer: Viewer,
    caseId: string,
    checkpoint: SurveyCheckpoint,
    ratings: Partial<Record<FeedbackArea, number>>,
    comment: string,
  ): fx.SubmitResult | "not-allowed" {
    const onboarding = findCase(caseId);
    if (!onboarding || !canGiveFeedback(viewer, caseId)) return "not-allowed";
    const { feedback, result } = fx.submitSurvey(ensureState().feedback, onboarding, checkpoint, ratings, comment, todayISO());
    setFeedback(feedback);
    return result;
  },

  reviewTopic(viewer: Viewer, topicId: string, decision: "share" | "keep-private", note = "") {
    const current = ensureState().feedback;
    const topic = current.topics.find((t) => t.id === topicId);
    if (!topic || !canGiveFeedback(viewer, topic.caseId)) return;
    setFeedback(fx.reviewTopic(current, topicId, decision, note, todayISO()));
  },

  bookMeeting(
    viewer: Viewer,
    caseId: string,
    type: MeetingType,
    slotId: string,
    employeePoints: string[],
  ): { result: fx.BookResult | "not-allowed"; meeting?: Meeting } {
    const onboarding = findCase(caseId);
    if (!onboarding) return { result: "case-not-found" };
    if (!canGiveFeedback(viewer, caseId)) return { result: "not-allowed" };
    const booked = fx.bookMeeting(ensureState().feedback, onboarding, { type, slotId, employeePoints }, todayISO(), createId());
    setFeedback(booked.feedback);
    return { result: booked.result, meeting: booked.meeting };
  },

  cancelMeeting(viewer: Viewer, meetingId: string) {
    const current = ensureState().feedback;
    const meeting = current.meetings.find((m) => m.id === meetingId);
    if (!meeting || !canCancelMeeting(viewer, meeting.caseId)) return;
    setFeedback(fx.cancelMeeting(current, meetingId, todayISO()));
  },

  addAgendaPoint(viewer: Viewer, meetingId: string, text: string) {
    const current = ensureState().feedback;
    const meeting = current.meetings.find((m) => m.id === meetingId);
    if (!meeting || !canAddAgendaPoint(viewer, meeting.caseId)) return;
    setFeedback(fx.addAgendaPoint(current, meetingId, text, viewer.role === "hr" ? "HR" : "Employee"));
  },

  completeMeeting(viewer: Viewer, meetingId: string, outcome: string, hrNote: string) {
    if (!canManageCheckIns(viewer)) return;
    setFeedback(fx.completeMeeting(ensureState().feedback, meetingId, outcome, hrNote, todayISO()));
  },

  createAction(viewer: Viewer, input: fx.ActionInput): { error?: fx.ActionError | "not-allowed" } {
    if (!canManageCheckIns(viewer)) return { error: "not-allowed" };
    const current = ensureState();
    const created = fx.createAction(current.feedback, current.cases, input, todayISO(), createId(), byLabel(viewer));
    setFeedback(created.feedback);
    return created.error ? { error: created.error } : {};
  },

  setActionStatus(viewer: Viewer, actionId: string, status: ActionStatus) {
    const current = ensureState().feedback;
    const action = current.actions.find((a) => a.id === actionId);
    if (!action || !canSetActionStatus(viewer, action)) return;
    setFeedback(fx.setActionStatus(current, actionId, status, todayISO(), byLabel(viewer)));
  },

  recordFollowUp(viewer: Viewer, actionId: string, response: FollowUpResponse) {
    const current = ensureState().feedback;
    const action = current.actions.find((a) => a.id === actionId);
    if (!action || !canGiveFeedback(viewer, action.caseId)) return;
    setFeedback(fx.recordFollowUp(current, actionId, response, todayISO()));
  },

  reopenAction(viewer: Viewer, actionId: string, newDueDate?: ISODate) {
    const current = ensureState().feedback;
    const action = current.actions.find((a) => a.id === actionId);
    if (!action || !(canGiveFeedback(viewer, action.caseId) || canManageCheckIns(viewer))) return;
    setFeedback(fx.reopenAction(current, actionId, todayISO(), byLabel(viewer), newDueDate));
  },

  /** No data exists on the server; components render a loading state until hydrated. */
  getServerSnapshot(): OnboardingCase[] | null {
    return null;
  },

  addCase(input: NewOnboardingInput): OnboardingCase {
    const created = createCase(input);
    setState([created, ...onboardingStore.getSnapshot()]);
    return created;
  },

  setTaskStatus(caseId: string, taskId: string, status: TaskStatus) {
    setState(updateTaskStatus(onboardingStore.getSnapshot(), caseId, taskId, status, todayISO()));
  },

  /** Status change from the employee portal, limited by the access rules. */
  setTaskStatusAs(viewer: Viewer, caseId: string, taskId: string, status: TaskStatus) {
    const current = onboardingStore.getSnapshot();
    const next = updateTaskStatusAs(viewer, current, caseId, taskId, status, todayISO());
    if (next.some((c, i) => c !== current[i])) setState(next);
  },

  deleteCase(caseId: string) {
    setState(removeCase(onboardingStore.getSnapshot(), caseId));
  },

  resetDemo() {
    const cases = createSeedCases(todayISO());
    setWorkspace({
      cases,
      learning: createSeedLearning(cases, todayISO()),
      feedback: createSeedFeedback(cases, todayISO()),
    });
  },

  /** Test helper: forget the in-memory cache so the next read hits storage. */
  _resetForTests() {
    state = null;
  },
};
