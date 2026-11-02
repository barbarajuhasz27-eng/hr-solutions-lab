"use client";

import { ArrowLeft, UserX } from "lucide-react";
import { useState } from "react";
import { EmployeeTaskItem } from "@/components/portal/employee-task-item";
import { JourneyStrip, PHASE_STATE_LABEL, phaseAnchor, phaseDates } from "@/components/portal/journey-strip";
import { PortalSkeleton } from "@/components/portal/portal-home-view";
import { usePortalCase } from "@/components/portal/use-portal-case";
import { Badge, type Tone } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/cn";
import { firstName, getJourneyPhases, type PhaseState } from "@/lib/portal";

const STATE_TONE: Record<PhaseState, Tone> = {
  done: "success",
  current: "accent",
  "wrapping-up": "warning",
  upcoming: "neutral",
};

type Scope = "all" | "mine";

export function PortalJourneyView() {
  const state = usePortalCase();
  const [scope, setScope] = useState<Scope>("all");

  if (state.status === "loading") return <PortalSkeleton />;
  if (state.status === "empty") {
    return (
      <Card>
        <EmptyState icon={<UserX />} title="No onboarding to preview" description="There are no onboarding cases in this browser." />
      </Card>
    );
  }

  const { onboarding, today, viewer } = state;
  const phases = getJourneyPhases(onboarding, today);

  return (
    <>
      <ButtonLink href="/" variant="ghost" size="sm" className="-ml-2 mb-3">
        <ArrowLeft aria-hidden />
        Back to home
      </ButtonLink>
      <PageHeader
        eyebrow={`${firstName(onboarding.employeeName)}'s onboarding`}
        title="Your onboarding journey"
        description="Every step of your first 90 days: what you do, and what the people supporting you are preparing."
        actions={
          <fieldset className="flex rounded-lg border border-line-strong bg-surface p-0.5">
            <legend className="sr-only">Show steps</legend>
            {(
              [
                ["all", "All steps"],
                ["mine", "Just mine"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink",
                  "has-[:checked]:bg-accent has-[:checked]:text-white",
                  "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                )}
              >
                <input
                  type="radio"
                  name="journey-scope"
                  value={value}
                  checked={scope === value}
                  onChange={() => setScope(value)}
                  className="sr-only"
                />
                {label}
              </label>
            ))}
          </fieldset>
        }
      />

      <div className="space-y-6">
        <JourneyStrip phases={phases} />

        {phases.map((phase) => {
          const tasks = scope === "mine" ? phase.tasks.filter((t) => t.isOwn) : phase.tasks;
          const headingId = `${phaseAnchor(phase)}-title`;
          return (
            <Card key={phase.stage} id={phaseAnchor(phase)} aria-labelledby={headingId} className="scroll-mt-6">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id={headingId} className="text-[15px] font-semibold text-ink">
                      {phase.label}
                    </h2>
                    <Badge tone={STATE_TONE[phase.state]}>{PHASE_STATE_LABEL[phase.state]}</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted">
                    {phaseDates(phase)} · {phase.summary}
                  </p>
                </div>
                {phase.total > 0 ? (
                  <div className="w-40">
                    <p className="text-right text-xs text-muted tabular-nums">
                      {phase.done} of {phase.total} steps done
                    </p>
                    <ProgressBar
                      value={Math.round((phase.done / phase.total) * 100)}
                      label={`${phase.label} progress`}
                      size="sm"
                      className="mt-1.5"
                    />
                  </div>
                ) : null}
              </div>
              {tasks.length > 0 ? (
                <ul className="divide-y divide-line px-5">
                  {tasks.map((task) => (
                    <EmployeeTaskItem key={task.id} task={task} caseId={onboarding.id} viewer={viewer} showDescription />
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-4 text-sm text-muted">
                  {scope === "mine" ? "No steps for you in this phase." : "No steps planned in this phase."}
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
}
