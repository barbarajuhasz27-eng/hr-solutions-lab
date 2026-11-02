import { beforeEach, describe, expect, it } from "vitest";
import {
  canAddAgendaPoint,
  canGiveFeedback,
  canManageCheckIns,
  canSetActionStatus,
  canViewConfidentialFeedback,
} from "@/lib/access";
import { availableSlots, EMPTY_FEEDBACK } from "@/lib/feedback";
import { createSeedFeedback } from "@/lib/feedback-seed";
import { createSeedLearning } from "@/lib/learning-seed";
import { isFeedbackState, loadWorkspace, onboardingStore, saveCases, STORAGE_KEY } from "@/lib/onboarding-store";
import { createSeedCases } from "@/lib/seed-data";
import { TODAY } from "./helpers";

const DANIEL = "demo-daniel-okafor";
const daniel = { role: "new-hire" as const, caseId: DANIEL };
const maya = { role: "new-hire" as const, caseId: "demo-maya-lindqvist" };
const hr = { role: "hr" as const };
const good = { "role-clarity": 4, "learning-development": 4, "manager-support": 2, "team-integration": 4, "tools-resources": 4 };

const stored = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
const fb = () => onboardingStore.getFeedbackSnapshot();

beforeEach(() => {
  window.localStorage.clear();
  onboardingStore._resetForTests();
});

describe("loading and migration", () => {
  it("seeds feedback with cases and learning on first visit", () => {
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w.feedbackSource).toBe("generated");
    expect(isFeedbackState(w.feedback)).toBe(true);
    expect(w.feedback.responses).toHaveLength(12);
  });

  it("adds feedback to data saved before it existed, keeping cases and learning unchanged", () => {
    const cases = createSeedCases(TODAY);
    const learning = createSeedLearning(cases, TODAY);
    saveCases(window.localStorage, cases, learning);
    expect(stored().feedback).toBeUndefined();
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w).toMatchObject({ source: "stored", learningSource: "stored", feedbackSource: "generated", needsSave: true });
    expect(w.cases).toEqual(cases);
    expect(w.learning).toEqual(learning);
  });

  it("migrates v2 data and gives it feedback", () => {
    const v2 = createSeedCases(TODAY).map(({ contacts: _c, ...rest }) => (void _c, rest));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, cases: v2 }));
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w.source).toBe("migrated");
    expect(w.feedbackSource).toBe("generated");
  });

  it("round-trips stored feedback and does not resave it", () => {
    const cases = createSeedCases(TODAY);
    const feedback = createSeedFeedback(cases, TODAY);
    saveCases(window.localStorage, cases, createSeedLearning(cases, TODAY), feedback);
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w.feedbackSource).toBe("stored");
    expect(w.feedback).toEqual(feedback);
    expect(w.needsSave).toBe(false);
  });

  it("rebuilds invalid feedback without discarding cases or learning", () => {
    const cases = createSeedCases(TODAY).slice(0, 4);
    const learning = createSeedLearning(cases, TODAY);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 3, cases, learning, feedback: { responses: [{ id: "x", ratings: { "role-clarity": 9 } }], topics: [], meetings: [], actions: [] } }),
    );
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w).toMatchObject({ source: "stored", learningSource: "stored", feedbackSource: "recovered" });
    expect(w.cases).toEqual(cases);
    expect(isFeedbackState(w.feedback)).toBe(true);
  });

  it("drops feedback of cases that no longer exist", () => {
    const cases = createSeedCases(TODAY);
    saveCases(window.localStorage, cases.filter((c) => c.id !== "demo-sofia-marin"), undefined, createSeedFeedback(cases, TODAY));
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w.feedback.responses.some((r) => r.caseId === "demo-sofia-marin")).toBe(false);
    expect(w.feedback.actions.some((a) => a.caseId === "demo-sofia-marin")).toBe(false);
  });

  it("validates records strictly", () => {
    const valid = createSeedFeedback(createSeedCases(TODAY), TODAY);
    expect(isFeedbackState(valid)).toBe(true);
    expect(isFeedbackState(EMPTY_FEEDBACK)).toBe(true);
    expect(isFeedbackState({ ...valid, meetings: [{ ...valid.meetings[0], time: "9am" }] })).toBe(false);
    expect(isFeedbackState({ ...valid, topics: [{ ...valid.topics[0], status: "warning" }] })).toBe(false);
    expect(isFeedbackState({ ...valid, actions: [{ ...valid.actions[0], owner: "Robot" }] })).toBe(false);
    expect(isFeedbackState({ responses: [] })).toBe(false);
  });
});

describe("simulated access rules", () => {
  it("separates employee decisions, shared agenda points and HR record keeping", () => {
    expect(canGiveFeedback(daniel, DANIEL)).toBe(true);
    expect(canGiveFeedback(maya, DANIEL)).toBe(false);
    expect(canGiveFeedback(hr, DANIEL)).toBe(false);
    expect(canAddAgendaPoint(hr, DANIEL)).toBe(true);
    expect(canAddAgendaPoint(maya, DANIEL)).toBe(false);
    expect(canManageCheckIns(hr)).toBe(true);
    expect(canManageCheckIns(daniel)).toBe(false);
    expect(canSetActionStatus(daniel, { caseId: DANIEL, owner: "Employee" })).toBe(true);
    expect(canSetActionStatus(daniel, { caseId: DANIEL, owner: "HR" })).toBe(false);
    expect(canViewConfidentialFeedback(maya, DANIEL)).toBe(false);
  });
});

describe("store actions", () => {
  it("lets only the employee submit their own survey, once, and persists it", () => {
    expect(onboardingStore.submitSurvey(hr, DANIEL, "day-7", good, "")).toBe("not-allowed");
    expect(onboardingStore.submitSurvey(maya, DANIEL, "day-7", good, "")).toBe("not-allowed");
    expect(onboardingStore.submitSurvey(daniel, DANIEL, "day-7", good, "A comment")).toBe("submitted");
    expect(onboardingStore.submitSurvey(daniel, DANIEL, "day-7", good, "")).toBe("already-submitted");
    expect(stored().feedback.responses.filter((r: { caseId: string }) => r.caseId === DANIEL)).toHaveLength(1);
    expect(fb().topics.filter((t) => t.caseId === DANIEL).map((t) => t.status)).toEqual(["suggested"]);
    expect(fb().actions.filter((a) => a.caseId === DANIEL)).toEqual([]);
  });

  it("lets only the employee share their topics", () => {
    onboardingStore.submitSurvey(daniel, DANIEL, "day-7", good, "");
    const topic = fb().topics.find((t) => t.caseId === DANIEL)!;
    onboardingStore.reviewTopic(hr, topic.id, "share");
    expect(fb().topics.find((t) => t.id === topic.id)!.status).toBe("suggested");
    onboardingStore.reviewTopic(daniel, topic.id, "share", "My note");
    expect(fb().topics.find((t) => t.id === topic.id)).toMatchObject({ status: "shared", employeeNote: "My note" });
  });

  it("books, prevents double booking through the store and frees slots on cancel", () => {
    const cases = onboardingStore.getSnapshot();
    const danielCase = cases.find((c) => c.id === DANIEL)!;
    const slot = availableSlots(danielCase, "hr", fb().meetings, TODAY)[0];
    expect(onboardingStore.bookMeeting(hr, DANIEL, "hr", slot.id, []).result).toBe("not-allowed");
    const booked = onboardingStore.bookMeeting(daniel, DANIEL, "hr", slot.id, ["Pension question"]);
    expect(booked.result).toBe("booked");
    expect(booked.meeting!.agenda.at(-1)).toMatchObject({ source: "employee", text: "Pension question" });
    // Marcus has the same HR partner.
    const marcus = { role: "new-hire" as const, caseId: "demo-marcus-bell" };
    expect(onboardingStore.bookMeeting(marcus, "demo-marcus-bell", "hr", slot.id, []).result).toBe("slot-taken");
    onboardingStore.cancelMeeting(maya, booked.meeting!.id);
    expect(fb().meetings.find((m) => m.id === booked.meeting!.id)!.status).toBe("scheduled");
    onboardingStore.cancelMeeting(daniel, booked.meeting!.id);
    expect(onboardingStore.bookMeeting(marcus, "demo-marcus-bell", "hr", slot.id, []).result).toBe("booked");
  });

  it("keeps outcomes and actions in the HR workspace, and follow-ups with the employee", () => {
    const sofiaMeeting = fb().meetings.find((m) => m.caseId === "demo-sofia-marin")!;
    const input = {
      caseId: "demo-sofia-marin",
      description: "Share the Finance reporting glossary",
      owner: "HR" as const,
      dueDate: "2026-11-20",
      source: { kind: "meeting" as const, meetingId: sofiaMeeting.id },
    };
    expect(onboardingStore.createAction(daniel, input).error).toBe("not-allowed");
    expect(onboardingStore.createAction(hr, input).error).toBeUndefined();
    const created = fb().actions.find((a) => a.description === input.description)!;
    onboardingStore.setActionStatus(hr, created.id, "Completed");
    onboardingStore.recordFollowUp(hr, created.id, "helped");
    expect(fb().actions.find((a) => a.id === created.id)!.followUps).toEqual([]);
    onboardingStore.recordFollowUp({ role: "new-hire", caseId: "demo-sofia-marin" }, created.id, "not-helped");
    onboardingStore.reopenAction({ role: "new-hire", caseId: "demo-sofia-marin" }, created.id, "2026-12-01");
    expect(fb().actions.find((a) => a.id === created.id)).toMatchObject({ status: "Open", reopenCount: 1, dueDate: "2026-12-01" });
  });

  it("removes feedback with a deleted case and restores the seed on reset", () => {
    onboardingStore.deleteCase("demo-lena-fischer");
    expect(fb().responses.some((r) => r.caseId === "demo-lena-fischer")).toBe(false);
    onboardingStore.submitSurvey(daniel, DANIEL, "day-7", good, "");
    onboardingStore.resetDemo();
    expect(fb().responses.some((r) => r.caseId === DANIEL)).toBe(false);
    expect(fb().responses.some((r) => r.caseId === "demo-lena-fischer")).toBe(true);
  });
});
