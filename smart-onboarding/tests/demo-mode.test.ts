import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PREVIEW,
  demoModeStore,
  parsePreview,
  PREVIEW_STORAGE_KEY,
  resolvePreviewCase,
} from "@/lib/demo-mode";
import { onboardingStore, STORAGE_KEY } from "@/lib/onboarding-store";
import { createSeedCases } from "@/lib/seed-data";
import { makeCase, TODAY } from "./helpers";

beforeEach(() => {
  window.localStorage.clear();
  demoModeStore._resetForTests();
  onboardingStore._resetForTests();
});

describe("parsePreview", () => {
  it("opens as a new hire by default", () => {
    expect(DEFAULT_PREVIEW).toEqual({ role: "new-hire", caseId: "demo-daniel-okafor" });
    expect(parsePreview(null)).toEqual(DEFAULT_PREVIEW);
  });

  it("falls back to the default for unknown or malformed values", () => {
    expect(parsePreview("{oops")).toEqual(DEFAULT_PREVIEW);
    expect(parsePreview(JSON.stringify({ role: "admin", caseId: "x" }))).toEqual(DEFAULT_PREVIEW);
    expect(parsePreview("null")).toEqual(DEFAULT_PREVIEW);
  });

  it("reads valid values", () => {
    expect(parsePreview(JSON.stringify({ role: "hr", caseId: null }))).toEqual({ role: "hr", caseId: null });
    expect(parsePreview(JSON.stringify({ role: "new-hire", caseId: 7 }))).toEqual({ role: "new-hire", caseId: null });
  });
});

describe("resolvePreviewCase", () => {
  const seed = createSeedCases(TODAY);

  it("uses the chosen case when it exists", () => {
    expect(resolvePreviewCase(seed, "demo-maya-lindqvist", TODAY)?.employeeName).toBe("Maya Lindqvist");
  });

  it("otherwise picks the active case that started most recently", () => {
    expect(resolvePreviewCase(seed, null, TODAY)?.id).toBe("demo-daniel-okafor");
    expect(resolvePreviewCase(seed, "deleted-case", TODAY)?.id).toBe("demo-daniel-okafor");
  });

  it("falls back to the next starter, then any case, then none", () => {
    const future = [makeCase(20, [{ key: "a" }], "later"), makeCase(5, [{ key: "a" }], "sooner")];
    expect(resolvePreviewCase(future, null, TODAY)?.id).toBe("sooner");
    const finished = [makeCase(-100, [{ key: "a", status: "Completed", dueIn: -100 }], "done")];
    expect(resolvePreviewCase(finished, null, TODAY)?.id).toBe("done");
    expect(resolvePreviewCase([], null, TODAY)).toBeNull();
  });
});

describe("demoModeStore", () => {
  it("persists the preview separately from the workspace data", () => {
    demoModeStore.setRole("hr");
    expect(JSON.parse(window.localStorage.getItem(PREVIEW_STORAGE_KEY)!)).toMatchObject({ role: "hr" });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
    demoModeStore._resetForTests();
    expect(demoModeStore.getSnapshot().role).toBe("hr");
  });

  it("switches to the New Hire preview of a chosen case", () => {
    demoModeStore.setRole("hr");
    demoModeStore.previewCase("demo-sofia-marin");
    expect(demoModeStore.getSnapshot()).toEqual({ role: "new-hire", caseId: "demo-sofia-marin" });
  });

  it("is not changed by resetting the demo data", () => {
    demoModeStore.setRole("hr");
    onboardingStore.resetDemo();
    demoModeStore._resetForTests();
    expect(demoModeStore.getSnapshot().role).toBe("hr");
  });

  it("notifies subscribers and returns a stable snapshot", () => {
    let calls = 0;
    const unsubscribe = demoModeStore.subscribe(() => calls++);
    const first = demoModeStore.getSnapshot();
    expect(demoModeStore.getSnapshot()).toBe(first);
    demoModeStore.setRole("new-hire"); // unchanged: no notification
    demoModeStore.setRole("hr");
    unsubscribe();
    demoModeStore.setRole("new-hire");
    expect(calls).toBe(1);
  });
});
