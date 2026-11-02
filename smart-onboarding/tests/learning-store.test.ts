import { beforeEach, describe, expect, it } from "vitest";
import { canUpdateLearning } from "@/lib/access";
import { EMPTY_FEEDBACK } from "@/lib/feedback";
import { assignmentId, createAssignments } from "@/lib/learning";
import { getModule } from "@/lib/learning-catalog";
import { demoAnswers } from "@/lib/learning-seed";
import {
  isLearningAssignment,
  loadCases,
  loadWorkspace,
  onboardingStore,
  saveCases,
  STORAGE_KEY,
} from "@/lib/onboarding-store";
import { createSeedCases } from "@/lib/seed-data";
import { TODAY } from "./helpers";

const DANIEL = "demo-daniel-okafor";
const MAYA = "demo-maya-lindqvist";
const daniel = { role: "new-hire" as const, caseId: DANIEL };
const hr = { role: "hr" as const, caseId: DANIEL };

const stored = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
const find = (id: string) => onboardingStore.getLearningSnapshot().find((a) => a.id === id)!;

beforeEach(() => {
  window.localStorage.clear();
  onboardingStore._resetForTests();
});

describe("loading the workspace", () => {
  it("seeds cases and learning together on first visit", () => {
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w.source).toBe("seed");
    expect(w.learningSource).toBe("generated");
    expect(w.learning).toHaveLength(42);
    expect(w.learning.every(isLearningAssignment)).toBe(true);
  });

  it("generates learning for v3 data saved before the Learning Center, keeping the cases", () => {
    const cases = createSeedCases(TODAY).slice(0, 2);
    saveCases(window.localStorage, cases);
    expect(stored().learning).toBeUndefined();
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w.source).toBe("stored");
    expect(w.cases).toEqual(cases);
    expect(w.learningSource).toBe("generated");
    expect(new Set(w.learning.map((a) => a.caseId))).toEqual(new Set(cases.map((c) => c.id)));
    expect(w.needsSave).toBe(true);
  });

  it("generates learning for migrated v2 data", () => {
    const v2 = createSeedCases(TODAY).map(({ contacts: _c, ...rest }) => (void _c, rest));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, cases: v2 }));
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w.source).toBe("migrated");
    expect(w.learningSource).toBe("generated");
    expect(w.learning.length).toBeGreaterThan(0);
  });

  it("reads stored learning and reconciles it with the cases", () => {
    const cases = createSeedCases(TODAY);
    const progress = createAssignments(cases[0]).map((a, i) => (i === 0 ? { ...a, viewedLessonIds: ["values"] } : a));
    const orphan = { ...createAssignments(cases[0])[0], id: "gone--learn--culture-values", caseId: "gone" };
    saveCases(window.localStorage, cases, [...progress, orphan]);
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w.learningSource).toBe("stored");
    expect(w.learning.find((a) => a.id === progress[0].id)!.viewedLessonIds).toEqual(["values"]);
    expect(w.learning.some((a) => a.caseId === "gone")).toBe(false);
    expect(w.learning.filter((a) => a.caseId === cases[1].id).length).toBeGreaterThan(0);
  });

  it("does not resave unchanged stored data", () => {
    const cases = createSeedCases(TODAY);
    const learning = cases.flatMap(createAssignments);
    saveCases(window.localStorage, cases, learning, EMPTY_FEEDBACK);
    expect(loadWorkspace(window.localStorage, TODAY)).toMatchObject({ learningSource: "stored", needsSave: false });
  });

  it("rebuilds invalid learning data without discarding the cases", () => {
    const cases = createSeedCases(TODAY).slice(0, 3);
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 3, cases, learning: [{ id: "x", moduleId: "not-a-module" }] }),
    );
    const w = loadWorkspace(window.localStorage, TODAY);
    expect(w.source).toBe("stored");
    expect(w.cases).toEqual(cases);
    expect(w.learningSource).toBe("recovered");
    expect(w.learning.every(isLearningAssignment)).toBe(true);
  });

  it("keeps loadCases working as before", () => {
    const cases = createSeedCases(TODAY).slice(0, 1);
    saveCases(window.localStorage, cases, cases.flatMap(createAssignments));
    expect(loadCases(window.localStorage, TODAY)).toEqual({ cases, source: "stored" });
  });

  it("validates assignments strictly", () => {
    const a = createAssignments(createSeedCases(TODAY)[0])[0];
    expect(isLearningAssignment(a)).toBe(true);
    expect(isLearningAssignment({ ...a, checkpoint: "day-14" })).toBe(false);
    expect(isLearningAssignment({ ...a, dueDate: "2026-02-30" })).toBe(false);
    expect(isLearningAssignment({ ...a, viewedLessonIds: [1] })).toBe(false);
    expect(isLearningAssignment({ ...a, quizResults: [{ passed: true }] })).toBe(false);
    expect(isLearningAssignment({ ...a, completedAt: "soon" })).toBe(false);
  });
});

describe("access", () => {
  it("lets only the new hire who owns the assignment record learning", () => {
    expect(canUpdateLearning(daniel, { caseId: DANIEL })).toBe(true);
    expect(canUpdateLearning(daniel, { caseId: MAYA })).toBe(false);
    expect(canUpdateLearning(hr, { caseId: DANIEL })).toBe(false);
  });
});

describe("store learning actions", () => {
  const healthSafety = assignmentId(DANIEL, "health-safety");

  it("records the new hire's own lessons and quiz attempts, and persists them", () => {
    // Seeded: Daniel has read 2 of 3 health & safety lessons and the module is overdue.
    const lessons = getModule("health-safety").lessons;
    onboardingStore.viewLesson(daniel, healthSafety, lessons[2].id);
    expect(find(healthSafety).viewedLessonIds).toHaveLength(3);
    onboardingStore.submitQuiz(daniel, healthSafety, demoAnswers(getModule("health-safety").quiz!, "pass"));
    expect(find(healthSafety).completedAt).toBe(TODAY);
    expect(stored().learning.find((a: { id: string }) => a.id === healthSafety).completedAt).toBe(TODAY);
  });

  it("ignores HR and other employees", () => {
    const before = onboardingStore.getLearningSnapshot();
    onboardingStore.viewLesson(hr, healthSafety, getModule("health-safety").lessons[2].id);
    onboardingStore.viewLesson({ role: "new-hire", caseId: MAYA }, healthSafety, getModule("health-safety").lessons[2].id);
    expect(onboardingStore.getLearningSnapshot()).toBe(before);
  });

  it("adds learning paths for new cases and removes them with deleted cases", () => {
    const c = onboardingStore.addCase({
      employeeName: "Test Hire",
      jobTitle: "Analyst",
      department: "Finance",
      hiringManager: "Some Manager",
      location: "Lisbon",
      employmentType: "Full-time",
      startDate: "2026-11-16",
      workflow: { workArrangement: "Office", peopleManager: false, internationalHire: false },
    });
    expect(onboardingStore.getLearningSnapshot().filter((a) => a.caseId === c.id)).toHaveLength(4);
    onboardingStore.deleteCase(c.id);
    expect(onboardingStore.getLearningSnapshot().some((a) => a.caseId === c.id)).toBe(false);
  });

  it("restores the seeded progress on reset", () => {
    onboardingStore.viewLesson(daniel, healthSafety, getModule("health-safety").lessons[2].id);
    onboardingStore.resetDemo();
    expect(find(healthSafety).viewedLessonIds).toHaveLength(2);
  });
});
