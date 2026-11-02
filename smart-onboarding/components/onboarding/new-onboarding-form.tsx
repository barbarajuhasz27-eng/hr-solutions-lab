"use client";

import { ArrowLeft, Building2, Globe2, Info, Laptop, ListChecks, ShieldCheck, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import { RequirementBadge } from "@/components/tasks/task-dependencies";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, SelectInput, TextInput } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { addDays, formatShortDate, isValidISODate } from "@/lib/dates";
import { onboardingActions } from "@/lib/use-onboarding";
import {
  EMPTY_FORM,
  toNewOnboardingInput,
  validateNewOnboarding,
  type FormErrors,
  type FormValues,
  type NewOnboardingField,
} from "@/lib/validation";
import { buildWorkflowTemplate, modulesFor, WORKFLOW_MODULES } from "@/lib/workflow-templates";
import { EMPLOYMENT_TYPES, ONBOARDING_STAGES, WORK_ARRANGEMENTS, type WorkflowContext } from "@/types/onboarding";

const FIELD_ORDER: NewOnboardingField[] = [
  "employeeName",
  "jobTitle",
  "department",
  "hiringManager",
  "location",
  "startDate",
  "employmentType",
  "workArrangement",
];

type TextFieldName = "employeeName" | "jobTitle" | "department" | "hiringManager" | "location";

const DEPARTMENT_SUGGESTIONS = [
  "Customer Success",
  "Engineering",
  "Finance",
  "Marketing",
  "Operations",
  "People",
  "Product",
  "Sales",
];

function OptionCard({
  checked,
  onChange,
  icon,
  title,
  description,
  type,
  name,
  value,
}: {
  checked: boolean;
  onChange: () => void;
  icon: ReactNode;
  title: string;
  description: string;
  type: "radio" | "checkbox";
  name: string;
  value?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40",
        checked ? "border-accent bg-accent-soft/50" : "border-line-strong bg-surface hover:bg-subtle",
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-sm font-medium text-ink [&_svg]:size-4 [&_svg]:text-muted">
          {icon}
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted">{description}</span>
      </span>
    </label>
  );
}

export function NewOnboardingForm() {
  const router = useRouter();
  const { notify } = useToast();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const update = <K extends keyof FormValues>(field: K, value: FormValues[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    // After the first submit attempt, re-validate live so errors clear as they are fixed.
    if (submitted) setErrors(validateNewOnboarding(next));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const nextErrors = validateNewOnboarding(values);
    setErrors(nextErrors);

    const firstInvalid = FIELD_ORDER.find((field) => nextErrors[field]);
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
      return;
    }

    setSaving(true);
    const created = onboardingActions.addCase(toNewOnboardingInput(values));
    notify(`Onboarding case created for ${created.employeeName} with ${created.tasks.length} tasks.`);
    router.push(`/onboarding/${created.id}`);
  };

  const errorCount = Object.keys(errors).length;
  const describedBy = (field: NewOnboardingField) => (errors[field] ? `${field}-error` : undefined);

  const textField = (
    field: TextFieldName,
    label: string,
    placeholder: string,
    extra?: { list?: string; hint?: string },
  ) => (
    <Field id={field} label={label} required error={errors[field]} hint={extra?.hint}>
      <TextInput
        id={field}
        name={field}
        value={values[field]}
        onChange={(event) => update(field, event.target.value)}
        invalid={Boolean(errors[field])}
        aria-describedby={describedBy(field) ?? (extra?.hint ? `${field}-hint` : undefined)}
        aria-required="true"
        placeholder={placeholder}
        autoComplete="off"
        maxLength={80}
        list={extra?.list}
      />
    </Field>
  );

  const startDateValid = isValidISODate(values.startDate);
  const context: WorkflowContext = {
    workArrangement: values.workArrangement === "Remote" ? "Remote" : "Office",
    peopleManager: values.peopleManager,
    internationalHire: values.internationalHire,
  };
  const template = buildWorkflowTemplate(context);
  const modules = modulesFor(context);
  const mandatoryCount = template.filter((t) => t.mandatory).length;

  return (
    <>
      <ButtonLink href="/" variant="ghost" size="sm" className="-ml-2 mb-3">
        <ArrowLeft aria-hidden />
        Back to dashboard
      </ButtonLink>
      <PageHeader
        eyebrow="New onboarding case"
        title="Create onboarding"
        description="Enter the work details for a fictional new hire. An adaptive workflow is generated from the start date and onboarding context."
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3" aria-labelledby="form-heading">
          <CardHeader id="form-heading" title="Employee and role" description="Fields marked * are required." />
          <form noValidate onSubmit={handleSubmit} className="space-y-5 p-5">
            {submitted && errorCount > 0 ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                Please fix {errorCount} {errorCount === 1 ? "field" : "fields"} before creating the case.
              </div>
            ) : null}

            {textField("employeeName", "Employee name", "e.g. Alex Morgan", {
              hint: "Use a fictional name — this is a demo workspace.",
            })}
            <div className="grid gap-5 sm:grid-cols-2">
              {textField("jobTitle", "Job title", "e.g. Marketing Specialist")}
              {textField("department", "Department", "e.g. Marketing", { list: "department-options" })}
            </div>
            <datalist id="department-options">
              {DEPARTMENT_SUGGESTIONS.map((d) => (
                <option key={d} value={d} />
              ))}
            </datalist>
            <div className="grid gap-5 sm:grid-cols-2">
              {textField("hiringManager", "Hiring manager", "e.g. Sam Rivera")}
              {textField("location", "Location", "e.g. Dublin office (hybrid)")}
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="startDate" label="Start date" required error={errors.startDate}>
                <TextInput
                  id="startDate"
                  name="startDate"
                  type="date"
                  value={values.startDate}
                  onChange={(event) => update("startDate", event.target.value)}
                  invalid={Boolean(errors.startDate)}
                  aria-describedby={describedBy("startDate")}
                  aria-required="true"
                />
              </Field>
              <Field id="employmentType" label="Employment type" required error={errors.employmentType}>
                <SelectInput
                  id="employmentType"
                  name="employmentType"
                  value={values.employmentType}
                  onChange={(event) => update("employmentType", event.target.value)}
                  invalid={Boolean(errors.employmentType)}
                  aria-describedby={describedBy("employmentType")}
                >
                  {EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            </div>

            <fieldset className="space-y-3 border-t border-line pt-5">
              <legend className="text-sm font-semibold text-ink">Onboarding context</legend>
              <p className="-mt-1 text-xs text-muted">Decides which workflow modules are added to the core checklist.</p>
              <div role="radiogroup" aria-label="Work arrangement" className="grid gap-2 sm:grid-cols-2">
                {WORK_ARRANGEMENTS.map((arrangement) => (
                  <OptionCard
                    key={arrangement}
                    type="radio"
                    name="workArrangement"
                    value={arrangement}
                    checked={values.workArrangement === arrangement}
                    onChange={() => update("workArrangement", arrangement)}
                    icon={arrangement === "Office" ? <Building2 aria-hidden /> : <Laptop aria-hidden />}
                    title={`${arrangement} employee`}
                    description={WORKFLOW_MODULES[arrangement === "Office" ? "office" : "remote"].description}
                  />
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <OptionCard
                  type="checkbox"
                  name="peopleManager"
                  checked={values.peopleManager}
                  onChange={() => update("peopleManager", !values.peopleManager)}
                  icon={<Users aria-hidden />}
                  title="People manager"
                  description={WORKFLOW_MODULES.manager.description}
                />
                <OptionCard
                  type="checkbox"
                  name="internationalHire"
                  checked={values.internationalHire}
                  onChange={() => update("internationalHire", !values.internationalHire)}
                  icon={<Globe2 aria-hidden />}
                  title="International hire"
                  description="Adds HR review tasks only. No legal, immigration or eligibility decisions are made in this tool."
                />
              </div>
            </fieldset>

            <div className="flex items-start gap-2 rounded-lg bg-subtle px-3 py-2.5 text-xs text-muted ring-1 ring-line">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
              <p>
                Only work-related details are collected. Personal contact details, addresses and
                dates of birth are deliberately not requested.
              </p>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:justify-end">
              <ButtonLink href="/" variant="secondary">
                Cancel
              </ButtonLink>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating…" : "Create onboarding case"}
              </Button>
            </div>
          </form>
        </Card>

        <Card className="h-fit lg:col-span-2" aria-labelledby="preview-heading">
          <CardHeader
            id="preview-heading"
            icon={<ListChecks />}
            title="Generated workflow"
            description={`${template.length} tasks (${mandatoryCount} mandatory) from ${modules.length} modules.`}
          />
          <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3" aria-label="Applied workflow modules">
            {modules.map((m) => (
              <Badge key={m} tone={m === "core" ? "neutral" : "accent"}>
                {WORKFLOW_MODULES[m].label}
              </Badge>
            ))}
          </div>
          {!startDateValid ? (
            <p className="flex items-start gap-2 border-b border-line px-5 py-3 text-xs text-muted">
              <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
              Choose a start date to preview due dates.
            </p>
          ) : null}
          <ol className="divide-y divide-line">
            {ONBOARDING_STAGES.map((stage) => {
              const items = template.filter((t) => t.stage === stage);
              if (items.length === 0) return null;
              return (
                <li key={stage} className="px-5 py-3">
                  <p className="text-xs font-semibold tracking-wide text-muted uppercase">{stage}</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {items.map((item) => (
                      <li key={item.key} className="text-sm">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className={item.mandatory ? "text-ink-soft" : "text-muted"}>
                            {item.title}
                            {item.module !== "core" ? (
                              <span className="ml-1.5 text-[11px] text-accent">{WORKFLOW_MODULES[item.module].label}</span>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-xs text-muted tabular-nums">
                            {startDateValid
                              ? formatShortDate(addDays(values.startDate, item.offsetDays))
                              : item.offsetDays === 0
                                ? "Day 1"
                                : `${item.offsetDays > 0 ? "+" : ""}${item.offsetDays}d`}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          {!item.mandatory ? <RequirementBadge mandatory={false} /> : null}
                          <span className="text-xs text-muted">{item.owner}</span>
                          {item.dependsOn && item.dependsOn.length > 0 ? (
                            <span className="text-xs text-muted">
                              · after{" "}
                              {item.dependsOn
                                .map((key) => template.find((t) => t.key === key)?.title ?? key)
                                .join(", ")}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ol>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">
            Generic workflow examples only — not a legal, payroll or compliance checklist.
          </p>
        </Card>
      </div>
    </>
  );
}
