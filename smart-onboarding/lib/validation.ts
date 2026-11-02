import { isValidISODate } from "@/lib/dates";
import { EMPLOYMENT_TYPES, WORK_ARRANGEMENTS, type NewOnboardingInput } from "@/types/onboarding";

type TextField = "employeeName" | "jobTitle" | "department" | "hiringManager" | "location";

export type FormValues = Record<TextField, string> & {
  startDate: string;
  employmentType: string;
  workArrangement: string;
  peopleManager: boolean;
  internationalHire: boolean;
};

export type NewOnboardingField = TextField | "startDate" | "employmentType" | "workArrangement";
export type FormErrors = Partial<Record<NewOnboardingField, string>>;

export const EMPTY_FORM: FormValues = {
  employeeName: "",
  jobTitle: "",
  department: "",
  hiringManager: "",
  location: "",
  startDate: "",
  employmentType: "Full-time",
  workArrangement: "Office",
  peopleManager: false,
  internationalHire: false,
};

const MAX_LENGTH = 80;

const REQUIRED_TEXT_FIELDS: Record<TextField, string> = {
  employeeName: "Employee name",
  jobTitle: "Job title",
  department: "Department",
  hiringManager: "Hiring manager",
  location: "Location",
};

/** Validates the new onboarding form. Returns an empty object when valid. */
export function validateNewOnboarding(values: FormValues): FormErrors {
  const errors: FormErrors = {};

  for (const [field, label] of Object.entries(REQUIRED_TEXT_FIELDS) as [TextField, string][]) {
    const value = values[field].trim();
    if (!value) errors[field] = `${label} is required.`;
    else if (value.length < 2) errors[field] = `${label} must be at least 2 characters.`;
    else if (value.length > MAX_LENGTH) errors[field] = `${label} must be ${MAX_LENGTH} characters or fewer.`;
  }

  if (!values.startDate) errors.startDate = "Start date is required.";
  else if (!isValidISODate(values.startDate)) errors.startDate = "Enter a valid start date.";

  if (!(EMPLOYMENT_TYPES as readonly string[]).includes(values.employmentType)) {
    errors.employmentType = "Select an employment type.";
  }
  if (!(WORK_ARRANGEMENTS as readonly string[]).includes(values.workArrangement)) {
    errors.workArrangement = "Select a work arrangement.";
  }

  return errors;
}

export function toNewOnboardingInput(values: FormValues): NewOnboardingInput {
  return {
    employeeName: values.employeeName.trim(),
    jobTitle: values.jobTitle.trim(),
    department: values.department.trim(),
    hiringManager: values.hiringManager.trim(),
    location: values.location.trim(),
    startDate: values.startDate,
    employmentType: values.employmentType as NewOnboardingInput["employmentType"],
    workflow: {
      workArrangement: values.workArrangement as NewOnboardingInput["workflow"]["workArrangement"],
      peopleManager: values.peopleManager,
      internationalHire: values.internationalHire,
    },
  };
}
