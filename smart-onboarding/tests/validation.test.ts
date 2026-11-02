import { describe, expect, it } from "vitest";
import { EMPTY_FORM, toNewOnboardingInput, validateNewOnboarding, type FormValues } from "@/lib/validation";

const VALID: FormValues = {
  employeeName: "  Jordan Ellis ",
  jobTitle: "Support Engineer",
  department: "Engineering",
  hiringManager: "Casey Lund",
  location: "Remote",
  startDate: "2026-12-07",
  employmentType: "Fixed-term",
  workArrangement: "Remote",
  peopleManager: true,
  internationalHire: false,
};

describe("validateNewOnboarding", () => {
  it("requires every field", () => {
    const errors = validateNewOnboarding(EMPTY_FORM);
    expect(Object.keys(errors).sort()).toEqual(
      ["department", "employeeName", "hiringManager", "jobTitle", "location", "startDate"].sort(),
    );
    expect(errors.employeeName).toBe("Employee name is required.");
  });

  it("treats whitespace-only values as missing", () => {
    expect(validateNewOnboarding({ ...VALID, jobTitle: "   " }).jobTitle).toBe("Job title is required.");
  });

  it("rejects invalid dates and employment types", () => {
    expect(validateNewOnboarding({ ...VALID, startDate: "2026-02-30" }).startDate).toBe("Enter a valid start date.");
    expect(validateNewOnboarding({ ...VALID, employmentType: "Contractor" }).employmentType).toBeDefined();
  });

  it("rejects overly long values", () => {
    expect(validateNewOnboarding({ ...VALID, location: "x".repeat(81) }).location).toMatch(/80 characters/);
  });

  it("requires a known work arrangement", () => {
    expect(validateNewOnboarding({ ...VALID, workArrangement: "Hybrid" }).workArrangement).toBeDefined();
  });

  it("accepts a valid form and trims values", () => {
    expect(validateNewOnboarding(VALID)).toEqual({});
    expect(toNewOnboardingInput(VALID).employeeName).toBe("Jordan Ellis");
    expect(toNewOnboardingInput(VALID).workflow).toEqual({
      workArrangement: "Remote",
      peopleManager: true,
      internationalHire: false,
    });
  });
});
