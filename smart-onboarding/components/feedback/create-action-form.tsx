"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextInput } from "@/components/ui/form-controls";
import type { Viewer } from "@/lib/access";
import { addDays } from "@/lib/dates";
import { ACTION_DESCRIPTION_MAX_LENGTH, type ActionError } from "@/lib/feedback";
import { feedbackActions } from "@/lib/use-feedback";
import { ACTION_OWNERS, type ActionOwner, type ActionSource } from "@/types/feedback";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

const ERRORS: Record<ActionError | "not-allowed", string> = {
  "description-required": "Describe the action.",
  "invalid-due-date": "Choose a valid due date.",
  "case-not-found": "The onboarding case no longer exists.",
  "source-not-agreed": "Actions can only come from a completed check-in or a topic the employee shared.",
  "task-not-in-case": "The linked task does not belong to this onboarding.",
  "duplicates-task": "This is already an onboarding task. Link it below instead of creating a duplicate.",
  "not-allowed": "Only HR can record agreed actions in this demo.",
};

/**
 * Records an action agreed in a check-in or for a shared topic. It can link to an existing
 * onboarding task; no new task is generated.
 */
export function CreateActionForm({
  onboarding,
  source,
  viewer,
  today,
  idPrefix,
}: {
  onboarding: OnboardingCase;
  source: ActionSource;
  viewer: Viewer;
  today: ISODate;
  idPrefix: string;
}) {
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState<ActionOwner>("Employee");
  const [dueDate, setDueDate] = useState(addDays(today, 14));
  const [linkedTaskId, setLinkedTaskId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const result = feedbackActions.createAction(viewer, {
      caseId: onboarding.id,
      description,
      owner,
      dueDate,
      source,
      ...(linkedTaskId ? { linkedTaskId } : {}),
    });
    if (result.error) {
      setError(ERRORS[result.error]);
      setSaved(false);
      return;
    }
    setDescription("");
    setLinkedTaskId("");
    setError(null);
    setSaved(true);
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-line bg-subtle p-4" noValidate aria-label="Agree an action">
      <p className="text-sm font-semibold text-ink">Agree an action</p>
      <Field id={`${idPrefix}-description`} label="Description" required error={error && !description.trim() ? error : undefined}>
        <TextInput
          id={`${idPrefix}-description`}
          value={description}
          maxLength={ACTION_DESCRIPTION_MAX_LENGTH}
          onChange={(e) => {
            setDescription(e.target.value);
            setSaved(false);
          }}
        />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={`${idPrefix}-owner`} label="Owner">
          <SelectInput id={`${idPrefix}-owner`} value={owner} onChange={(e) => setOwner(e.target.value as ActionOwner)}>
            {ACTION_OWNERS.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </SelectInput>
        </Field>
        <Field id={`${idPrefix}-due`} label="Due date">
          <TextInput id={`${idPrefix}-due`} type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <Field
        id={`${idPrefix}-task`}
        label="Link to an existing onboarding task (optional)"
        hint="Linking keeps the task list as it is; no task is created or copied."
      >
        <SelectInput id={`${idPrefix}-task`} value={linkedTaskId} onChange={(e) => setLinkedTaskId(e.target.value)}>
          <option value="">No linked task</option>
          {onboarding.tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} ({t.status})
            </option>
          ))}
        </SelectInput>
      </Field>
      {error && description.trim() ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-emerald-800">
          Action added to the shared action plan.
        </p>
      ) : null}
      <Button type="submit" size="sm">
        <Plus aria-hidden />
        Add action
      </Button>
    </form>
  );
}
