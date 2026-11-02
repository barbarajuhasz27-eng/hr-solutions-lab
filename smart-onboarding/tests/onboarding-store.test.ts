import { beforeEach, describe, expect, it } from "vitest";
import { diffInDays, todayISO } from "@/lib/dates";
import {
  isOnboardingCase,
  loadCases,
  migrateV1Cases,
  onboardingStore,
  removeCase,
  saveCases,
  SCHEMA_VERSION,
  STORAGE_KEY,
  updateTaskStatus,
} from "@/lib/onboarding-store";
import { createSeedCases, SEED_CASE_IDS } from "@/lib/seed-data";
import { buildWorkflowTemplate } from "@/lib/workflow-templates";

const TODAY = "2026-11-02";

describe("seed data", () => {
  it("creates ten fictional cases with start dates relative to today", () => {
    const seed = createSeedCases(TODAY);
    expect(seed.map((c) => c.id)).toEqual(SEED_CASE_IDS);
    expect(seed.map((c) => diffInDays(TODAY, c.startDate))).toEqual([12, -8, -47, 5, 20, -95, -110, -25, -40, 30]);
    expect(seed.every(isOnboardingCase)).toBe(true);
  });

  it("generates each case's tasks from its own workflow context", () => {
    for (const c of createSeedCases(TODAY)) {
      expect(c.tasks.map((t) => t.templateKey).sort()).toEqual(
        buildWorkflowTemplate(c.workflow).map((t) => t.key).sort(),
      );
    }
  });

  it("covers every workflow module", () => {
    const seed = createSeedCases(TODAY);
    expect(seed.some((c) => c.workflow.workArrangement === "Remote")).toBe(true);
    expect(seed.some((c) => c.workflow.workArrangement === "Office")).toBe(true);
    expect(seed.some((c) => c.workflow.peopleManager)).toBe(true);
    expect(seed.some((c) => c.workflow.internationalHire)).toBe(true);
  });

  it("only sets completedAt on completed tasks, never in the future", () => {
    for (const c of createSeedCases(TODAY)) {
      for (const t of c.tasks) {
        if (t.status === "Completed") {
          expect(t.completedAt).toBeDefined();
          expect(diffInDays(TODAY, t.completedAt!)).toBeLessThanOrEqual(0);
        } else {
          expect(t.completedAt).toBeUndefined();
        }
      }
    }
  });
});

describe("loadCases", () => {
  beforeEach(() => window.localStorage.clear());

  it("seeds demo data when nothing is stored", () => {
    const result = loadCases(window.localStorage, TODAY);
    expect(result.source).toBe("seed");
    expect(result.cases).toEqual(createSeedCases(TODAY));
  });

  it("restores demo data when storage contains malformed JSON", () => {
    window.localStorage.setItem(STORAGE_KEY, "{not json");
    expect(loadCases(window.localStorage, TODAY).source).toBe("recovered");
  });

  it("restores demo data when the schema version is unknown", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, cases: createSeedCases(TODAY) }));
    const result = loadCases(window.localStorage, TODAY);
    expect(result.source).toBe("recovered");
    expect(result.cases).toHaveLength(10);
  });

  it("restores demo data when records have an invalid shape", () => {
    const broken = createSeedCases(TODAY);
    (broken[0].tasks[0] as { status: string }).status = "Done-ish";
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, cases: broken }));
    expect(loadCases(window.localStorage, TODAY).source).toBe("recovered");

    const noMandatory = createSeedCases(TODAY);
    delete (noMandatory[0].tasks[0] as { mandatory?: boolean }).mandatory;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, cases: noMandatory }));
    expect(loadCases(window.localStorage, TODAY).source).toBe("recovered");
  });

  it("round-trips valid saved data", () => {
    const cases = removeCase(createSeedCases(TODAY), SEED_CASE_IDS[0]);
    saveCases(window.localStorage, cases);
    const result = loadCases(window.localStorage, TODAY);
    expect(result.source).toBe("stored");
    expect(result.cases).toEqual(cases);
  });

  it("works when storage is unavailable", () => {
    expect(loadCases(undefined, TODAY).cases).toHaveLength(10);
    expect(() => saveCases(undefined, [])).not.toThrow();
  });
});

describe("schema v1 migration", () => {
  const v1Case = {
    id: "old-case",
    employeeName: "Old Record",
    jobTitle: "Designer",
    department: "Product",
    hiringManager: "Lead",
    location: "Office",
    startDate: "2026-11-20",
    employmentType: "Full-time",
    createdAt: "2026-10-01T09:00:00.000Z",
    tasks: [
      { id: "old-case--equipment", templateKey: "equipment", title: "Prepare laptop and equipment", description: "", owner: "IT", stage: "Pre-boarding", dueDate: "2026-11-15", status: "Blocked" },
      { id: "old-case--accounts", templateKey: "accounts", title: "Create system accounts and access", description: "", owner: "IT", stage: "Pre-boarding", dueDate: "2026-11-18", status: "Completed", completedAt: "2026-11-01" },
      { id: "old-case--confirm-access", templateKey: "confirm-access", title: "Confirm equipment and system access", description: "", owner: "IT", stage: "Day 1", dueDate: "2026-11-20", status: "Not started" },
    ],
  };

  it("upgrades version 1 data instead of discarding it", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, cases: [v1Case] }));
    const result = loadCases(window.localStorage, TODAY);
    expect(result.source).toBe("migrated");
    const [c] = result.cases;
    expect(c.workflow).toEqual({ workArrangement: "Office", peopleManager: false, internationalHire: false });
    expect(c.tasks.map((t) => [t.templateKey, t.status, t.mandatory, t.dependsOn, t.blockedCount])).toEqual([
      ["equipment", "Blocked", true, [], 1],
      // "accounts" maps to "system-access"; its prerequisite does not exist in the old case, so it is dropped.
      ["system-access", "Completed", true, [], 0],
      ["confirm-access", "Not started", true, ["equipment", "system-access"], 0],
    ]);
    expect(c.tasks[1].completedAt).toBe("2026-11-01");
  });

  it("produces valid v2 cases", () => {
    expect(migrateV1Cases([v1Case]).every(isOnboardingCase)).toBe(true);
  });
});

describe("updateTaskStatus", () => {
  const seed = createSeedCases(TODAY);
  const target = seed[0].tasks.find((t) => t.status === "Not started")!;

  it("sets completedAt when a task is completed and clears it when reopened", () => {
    const completed = updateTaskStatus(seed, seed[0].id, target.id, "Completed", TODAY);
    const done = completed[0].tasks.find((t) => t.id === target.id)!;
    expect(done.status).toBe("Completed");
    expect(done.completedAt).toBe(TODAY);

    const reopened = updateTaskStatus(completed, seed[0].id, target.id, "In progress", TODAY);
    const open = reopened[0].tasks.find((t) => t.id === target.id)!;
    expect(open.status).toBe("In progress");
    expect("completedAt" in open).toBe(false);
  });

  it("counts every move into Blocked", () => {
    let cases = updateTaskStatus(seed, seed[0].id, target.id, "Blocked", TODAY);
    cases = updateTaskStatus(cases, seed[0].id, target.id, "Blocked", TODAY); // no change: same status
    cases = updateTaskStatus(cases, seed[0].id, target.id, "In progress", TODAY);
    cases = updateTaskStatus(cases, seed[0].id, target.id, "Blocked", TODAY);
    expect(cases[0].tasks.find((t) => t.id === target.id)!.blockedCount).toBe(2);
  });

  it("does not mutate the input or touch other cases", () => {
    const before = JSON.stringify(seed);
    const next = updateTaskStatus(seed, seed[0].id, target.id, "In progress", TODAY);
    expect(JSON.stringify(seed)).toBe(before);
    expect(next[1]).toBe(seed[1]);
    expect(next[2]).toBe(seed[2]);
  });
});

describe("client store", () => {
  beforeEach(() => {
    window.localStorage.clear();
    onboardingStore._resetForTests();
  });

  it("persists new cases and status changes to localStorage", () => {
    const created = onboardingStore.addCase({
      employeeName: "Robin Vale",
      jobTitle: "Recruiter",
      department: "People",
      hiringManager: "Kim Hale",
      location: "Remote",
      startDate: "2026-12-01",
      employmentType: "Full-time",
      workflow: { workArrangement: "Remote", peopleManager: false, internationalHire: true },
    });
    onboardingStore.setTaskStatus(created.id, created.tasks[0].id, "Completed");

    onboardingStore._resetForTests();
    const reloaded = onboardingStore.getSnapshot();
    expect(reloaded).toHaveLength(11);
    expect(reloaded[0].id).toBe(created.id);
    expect(reloaded[0].tasks[0].status).toBe("Completed");
    expect(reloaded[0].tasks.some((t) => t.templateKey === "intl-hr-review")).toBe(true);
  });

  it("resets to the original demo cases", () => {
    onboardingStore.deleteCase(SEED_CASE_IDS[0]);
    expect(onboardingStore.getSnapshot()).toHaveLength(9);
    onboardingStore.resetDemo();
    expect(onboardingStore.getSnapshot()).toEqual(createSeedCases(todayISO()));
  });

  it("notifies subscribers on change", () => {
    let calls = 0;
    const unsubscribe = onboardingStore.subscribe(() => calls++);
    onboardingStore.resetDemo();
    unsubscribe();
    onboardingStore.resetDemo();
    expect(calls).toBe(1);
  });
});
