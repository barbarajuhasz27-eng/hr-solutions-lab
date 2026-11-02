import { beforeEach, describe, expect, it } from "vitest";
import { defaultContacts } from "@/lib/contacts";
import {
  createCase,
  isOnboardingCase,
  loadCases,
  migrateV2Cases,
  onboardingStore,
  SCHEMA_VERSION,
  STORAGE_KEY,
} from "@/lib/onboarding-store";
import { createSeedCases } from "@/lib/seed-data";
import { DEFAULT_WORKFLOW } from "@/lib/workflow-templates";
import { TODAY } from "./helpers";

/** Seed cases as version 2 stored them: identical, but without contacts. */
function v2Cases() {
  return createSeedCases(TODAY).map((c) => {
    const { contacts: _contacts, ...rest } = c;
    void _contacts;
    return rest;
  });
}

function store(version: number, cases: unknown) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version, cases }));
}

beforeEach(() => {
  window.localStorage.clear();
  onboardingStore._resetForTests();
});

describe("schema v3", () => {
  it("is the current version", () => {
    expect(SCHEMA_VERSION).toBe(3);
  });

  it("gives every seed case explicit, valid support contacts", () => {
    for (const c of createSeedCases(TODAY)) {
      expect(isOnboardingCase(c)).toBe(true);
      expect(c.contacts.hrPartner.role).toBe("People Partner");
      expect(c.contacts.buddy.role).toBe("Onboarding buddy");
    }
  });
});

describe("migration from v2 to v3", () => {
  it("keeps every case and task exactly and adds contacts", () => {
    const before = v2Cases();
    store(2, before);
    const result = loadCases(window.localStorage, TODAY);
    expect(result.source).toBe("migrated");
    expect(result.cases).toHaveLength(10);
    result.cases.forEach((c, i) => {
      const { contacts, ...rest } = c;
      expect(rest).toEqual(before[i]);
      expect(contacts).toEqual(defaultContacts(c.id, c.department));
    });
  });

  it("saves the upgraded data as v3 on first load", () => {
    store(2, v2Cases());
    const cases = onboardingStore.getSnapshot();
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
    expect(saved.version).toBe(3);
    expect(saved.cases).toEqual(cases);
    onboardingStore._resetForTests();
    expect(loadCases(window.localStorage, TODAY).source).toBe("stored");
  });

  it("keeps user progress made under v2", () => {
    const before = v2Cases();
    before[1].tasks[0] = { ...before[1].tasks[0], status: "Blocked", blockedCount: 3, blockedReason: "Waiting" };
    store(2, before);
    const task = loadCases(window.localStorage, TODAY).cases[1].tasks[0];
    expect(task).toMatchObject({ status: "Blocked", blockedCount: 3, blockedReason: "Waiting" });
  });

  it("assigns the same default contacts every time", () => {
    expect(defaultContacts("case-a", "Finance")).toEqual(defaultContacts("case-a", "Finance"));
    expect(migrateV2Cases([{ id: "x", department: "Sales" }])[0].contacts).toEqual(defaultContacts("x", "Sales"));
  });
});

describe("malformed or missing data", () => {
  it("restores demo data when v2 data is malformed", () => {
    const broken = v2Cases();
    (broken[0].tasks[0] as { status: string }).status = "Done-ish";
    store(2, broken);
    expect(loadCases(window.localStorage, TODAY).source).toBe("recovered");

    store(2, "not-an-array");
    expect(loadCases(window.localStorage, TODAY).source).toBe("recovered");
  });

  it("fills in contacts that are missing from v3 cases without touching the rest", () => {
    const cases = createSeedCases(TODAY);
    const { contacts: _c, ...withoutContacts } = cases[2];
    void _c;
    store(3, [cases[0], cases[1], withoutContacts, ...cases.slice(3)]);
    const result = loadCases(window.localStorage, TODAY);
    expect(result.source).toBe("migrated");
    expect(result.cases[0]).toEqual(cases[0]);
    expect(result.cases[2].contacts).toEqual(defaultContacts(cases[2].id, cases[2].department));
  });

  it("restores demo data when contacts are present but invalid", () => {
    for (const contacts of [
      null,
      "Clara",
      { hrPartner: { name: "", role: "People Partner" }, buddy: { name: "Mei", role: "Buddy" } },
      { hrPartner: { name: "Clara", role: "People Partner" } },
    ]) {
      const cases = createSeedCases(TODAY);
      store(3, [{ ...cases[0], contacts }, ...cases.slice(1)]);
      expect(loadCases(window.localStorage, TODAY).source).toBe("recovered");
    }
  });

  it("restores demo data when the v3 envelope is incomplete", () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 3 }));
    expect(loadCases(window.localStorage, TODAY).source).toBe("recovered");
    window.localStorage.setItem(STORAGE_KEY, "null");
    expect(loadCases(window.localStorage, TODAY).source).toBe("recovered");
  });
});

describe("new cases", () => {
  const input = {
    employeeName: "Robin Vale",
    jobTitle: "Recruiter",
    department: "People",
    hiringManager: "Kim Hale",
    location: "Remote",
    startDate: "2026-12-01",
    employmentType: "Full-time" as const,
    workflow: DEFAULT_WORKFLOW,
  };

  it("get default contacts when none are given", () => {
    const c = createCase(input, { id: "new-case" });
    expect(c.contacts).toEqual(defaultContacts("new-case", "People"));
    expect(isOnboardingCase(c)).toBe(true);
  });

  it("keep contacts that are given", () => {
    const contacts = {
      hrPartner: { name: "Ava Stone", role: "People Partner" },
      buddy: { name: "Theo Park", role: "Onboarding buddy" },
    };
    expect(createCase({ ...input, contacts }, { id: "x" }).contacts).toEqual(contacts);
  });
});
