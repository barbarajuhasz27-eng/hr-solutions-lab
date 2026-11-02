"use client";

import { ArrowRight, BookOpen, Clock3, GraduationCap, ListChecks, UserX } from "lucide-react";
import Link from "next/link";
import { DueLabel, LearningDisclaimer, LearningStatusBadge, progressText } from "@/components/learning/learning-ui";
import { PortalSkeleton } from "@/components/portal/portal-home-view";
import { usePortalCase } from "@/components/portal/use-portal-case";
import { RequirementBadge } from "@/components/tasks/task-dependencies";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import {
  assignmentProgress,
  assignmentsForCase,
  assignmentStatus,
  groupByCheckpoint,
  isAssignmentComplete,
  pathReason,
} from "@/lib/learning";
import { getModule, LEARNING_MODULES } from "@/lib/learning-catalog";
import { firstName } from "@/lib/portal";
import { useLearning } from "@/lib/use-learning";
import type { LearningAssignment } from "@/types/learning";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

export function LearningCatalogView() {
  const portal = usePortalCase();
  const learning = useLearning();

  if (portal.status === "loading" || !learning.hydrated) return <PortalSkeleton />;
  if (portal.status === "empty") {
    return (
      <Card>
        <EmptyState icon={<UserX />} title="No onboarding to preview" description="There are no onboarding cases in this browser." />
      </Card>
    );
  }
  const { onboarding, today } = portal;
  const assignments = assignmentsForCase(learning.assignments, onboarding.id);
  return <Catalog onboarding={onboarding} assignments={assignments} today={today} />;
}

function Catalog({
  onboarding,
  assignments,
  today,
}: {
  onboarding: OnboardingCase;
  assignments: LearningAssignment[];
  today: ISODate;
}) {
  const mandatory = assignments.filter((a) => a.mandatory);
  const mandatoryDone = mandatory.filter(isAssignmentComplete).length;
  const groups = groupByCheckpoint(assignments);
  const assignedIds = new Set(assignments.map((a) => a.moduleId));
  const others = LEARNING_MODULES.filter((m) => !assignedIds.has(m.id));

  return (
    <>
      <PageHeader
        eyebrow={`${firstName(onboarding.employeeName)}'s learning`}
        title="Learning Center"
        description="Short modules picked for your role and onboarding context, with a checkpoint for each."
      />

      <div className="space-y-6">
        <LearningDisclaimer />

        <section aria-label="Your learning progress" className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card sm:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium text-muted">Mandatory modules</p>
              <p className="text-sm font-semibold text-ink tabular-nums">
                {mandatoryDone} of {mandatory.length} done
              </p>
            </div>
            <ProgressBar
              value={mandatory.length === 0 ? 0 : Math.round((mandatoryDone / mandatory.length) * 100)}
              label="Mandatory modules done"
              className="mt-3"
            />
            <p className="mt-2 text-xs text-muted">
              Learning is tracked on its own. It helps you settle in and does not change your onboarding steps.
            </p>
          </div>
          <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
            <p className="text-sm font-medium text-muted">How completion works</p>
            <p className="mt-2 text-sm text-ink-soft">
              Read every lesson, then pass the short quiz (where there is one). You can retry a quiz as often as you like.
            </p>
          </div>
        </section>

        {groups.map((group) => (
          <section key={group.checkpoint} aria-labelledby={`cp-${group.checkpoint}`}>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`cp-${group.checkpoint}`} className="text-base font-semibold text-ink">
                By {group.label}
              </h2>
              {group.dueDate ? (
                <p className="text-sm text-muted">
                  Due <time dateTime={group.dueDate}>{formatDate(group.dueDate)}</time>
                </p>
              ) : null}
            </div>
            {group.assignments.length > 0 ? (
              <ul className="grid gap-3 md:grid-cols-2">
                {group.assignments.map((a) => (
                  <li key={a.id}>
                    <ModuleCard assignment={a} onboarding={onboarding} today={today} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-line-strong px-4 py-3 text-sm text-muted">
                No modules at this checkpoint.
              </p>
            )}
          </section>
        ))}

        {others.length > 0 ? (
          <section aria-labelledby="catalog-others">
            <h2 id="catalog-others" className="mb-1 text-base font-semibold text-ink">
              Also in the catalog
            </h2>
            <p className="mb-3 text-sm text-muted">Assigned to other roles, so not part of your path.</p>
            <ul className="grid gap-3 md:grid-cols-2">
              {others.map((m) => (
                <li key={m.id} className="rounded-xl border border-line bg-subtle p-4">
                  <p className="text-sm font-semibold text-ink-soft">{m.title}</p>
                  <p className="mt-1 text-sm text-muted">{m.summary}</p>
                  <p className="mt-2 text-xs text-muted">
                    {m.id === "leading-new-team" ? "Assigned to people managers" : "Assigned by onboarding context"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}

function ModuleCard({
  assignment,
  onboarding,
  today,
}: {
  assignment: LearningAssignment;
  onboarding: OnboardingCase;
  today: ISODate;
}) {
  const learningModule = getModule(assignment.moduleId);
  const status = assignmentStatus(assignment, today);
  const progress = assignmentProgress(assignment, learningModule);
  const cta = status === "Completed" ? "Review" : status === "Not started" ? "Start" : "Continue";
  return (
    <Link
      href={`/me/learning/${learningModule.id}`}
      className={cn(
        "group flex h-full flex-col rounded-xl border bg-surface p-4 shadow-card transition-colors hover:border-accent-ring",
        status === "Overdue" ? "border-red-200" : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            status === "Completed" ? "bg-emerald-50 text-emerald-700" : "bg-accent-soft text-accent-strong",
          )}
        >
          <GraduationCap className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink group-hover:text-accent-strong">{learningModule.title}</p>
          <p className="mt-0.5 text-sm text-muted">{learningModule.summary}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <LearningStatusBadge status={status} />
        <RequirementBadge mandatory={assignment.mandatory} />
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <Clock3 aria-hidden className="size-3" />
          {learningModule.durationMinutes} min
        </span>
        <span className="inline-flex items-center gap-1 text-xs text-muted">
          <BookOpen aria-hidden className="size-3" />
          {learningModule.lessons.length} lessons
        </span>
        {learningModule.quiz ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <ListChecks aria-hidden className="size-3" />
            Quiz
          </span>
        ) : null}
      </div>
      <ProgressBar value={progress.percent} label={`${learningModule.title} progress`} size="sm" className="mt-3" />
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">{progressText(progress)}</span>
        <DueLabel assignment={assignment} today={today} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-3">
        <span className="text-xs text-muted">{pathReason(onboarding, assignment.moduleId)}</span>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-accent group-hover:text-accent-strong">
          {cta}
          <span className="sr-only"> {learningModule.title}</span>
          <ArrowRight aria-hidden className="size-4" />
        </span>
      </div>
    </Link>
  );
}
