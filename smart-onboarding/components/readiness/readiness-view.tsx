"use client";

import { AlertOctagon, AlertTriangle, ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BlockedDownstream, groupByBlocker } from "@/components/readiness/blocked-downstream";
import { ExperienceSummary } from "@/components/experience/experience-summary";
import { CriticalTasksList } from "@/components/readiness/critical-tasks-list";
import { READINESS_DESCRIPTION, ReadinessBadge } from "@/components/readiness/readiness-badge";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/cn";
import { formatShortDate, formatRelative } from "@/lib/dates";
import { getBlockedDownstream } from "@/lib/dependencies";
import { isCaseActive } from "@/lib/metrics";
import {
  assessReadiness,
  getCriticalTasks,
  READINESS_STATUSES,
  type ReadinessAssessment,
  type ReadinessStatus,
} from "@/lib/readiness";
import { useOnboarding } from "@/lib/use-onboarding";
import { workflowLabel } from "@/lib/workflow-templates";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

type Filter = "All" | ReadinessStatus;

const SEVERITY_ORDER: Record<ReadinessStatus, number> = { "Not ready": 0, "At risk": 1, "On track": 2, Ready: 3 };

export function ReadinessView({ initialStatus }: { initialStatus?: string }) {
  const state = useOnboarding();
  const [filter, setFilter] = useState<Filter>(
    (READINESS_STATUSES as readonly string[]).includes(initialStatus ?? "") ? (initialStatus as ReadinessStatus) : "All",
  );

  return (
    <>
      <PageHeader
        eyebrow="Readiness & risk"
        title="Readiness and risk overview"
        description="Why each active onboarding is or isn't ready for its next milestone, and which tasks put readiness at risk."
      />
      {state.hydrated ? (
        <ReadinessContent cases={state.cases} today={state.today} filter={filter} onFilter={setFilter} />
      ) : (
        <div className="space-y-6" aria-busy="true" aria-label="Loading readiness">
          <Skeleton className="h-12 rounded-xl" />
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function ReadinessContent({
  cases,
  today,
  filter,
  onFilter,
}: {
  cases: OnboardingCase[];
  today: ISODate;
  filter: Filter;
  onFilter: (f: Filter) => void;
}) {
  const assessed = cases
    .filter(isCaseActive)
    .map((c) => ({ onboarding: c, assessment: assessReadiness(c, today) }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.assessment.status] - SEVERITY_ORDER[b.assessment.status] ||
        a.onboarding.startDate.localeCompare(b.onboarding.startDate),
    );
  const counts = Object.fromEntries(
    READINESS_STATUSES.map((s) => [s, assessed.filter((a) => a.assessment.status === s).length]),
  ) as Record<ReadinessStatus, number>;
  const shown = filter === "All" ? assessed : assessed.filter((a) => a.assessment.status === filter);
  const downstreamGroups = cases.flatMap((c) =>
    groupByBlocker(c.id, getBlockedDownstream(c, today), c.employeeName),
  );

  return (
    <div className="space-y-6">
      <details className="group rounded-xl border border-line bg-surface shadow-card">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3.5 text-sm font-medium text-ink">
          <BookOpen aria-hidden className="size-4 text-accent" />
          How readiness is assessed
          <span className="ml-auto text-xs text-muted group-open:hidden">Show rules</span>
          <span className="ml-auto hidden text-xs text-muted group-open:inline">Hide rules</span>
        </summary>
        <div className="border-t border-line px-5 py-4 text-sm text-ink-soft">
          <p>
            Each case is assessed against its <strong>next milestone</strong> (Day 1, 30, 60 or 90) using fixed
            rules — never a weighted score. Only <strong>mandatory</strong> tasks count; a completed task only
            counts when its mandatory prerequisites are completed too.
          </p>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            {READINESS_STATUSES.map((s) => (
              <div key={s} className="flex items-start gap-2">
                <dt className="shrink-0">
                  <ReadinessBadge status={s} />
                </dt>
                <dd className="text-xs text-muted">{READINESS_DESCRIPTION[s]}</dd>
              </div>
            ))}
          </dl>
        </div>
      </details>

      <div role="group" aria-label="Filter by readiness" className="flex flex-wrap gap-2">
        {(["All", ...READINESS_STATUSES] as Filter[]).map((f) => {
          const count = f === "All" ? assessed.length : counts[f];
          return (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => onFilter(f)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition-colors",
                filter === f ? "bg-ink text-white ring-ink" : "bg-surface text-ink-soft ring-line-strong hover:bg-subtle",
              )}
            >
              {f} <span className={cn("tabular-nums", filter === f ? "text-white/70" : "text-muted")}>{count}</span>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <Card>
          <EmptyState
            title={`No active onboardings are ${filter === "All" ? "in progress" : filter.toLowerCase()}`}
            description="Choose another readiness status to see those cases."
          />
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" aria-label="Readiness by case">
          {shown.map(({ onboarding, assessment }) => (
            <li key={onboarding.id}>
              <CaseReadinessCard onboarding={onboarding} assessment={assessment} today={today} />
            </li>
          ))}
        </ul>
      )}

      <CriticalTasksList items={getCriticalTasks(cases, today)} today={today} />

      <BlockedDownstream groups={downstreamGroups} showEmployee />

      <ExperienceSummary variant="readiness" />
    </div>
  );
}

function CaseReadinessCard({
  onboarding,
  assessment,
  today,
}: {
  onboarding: OnboardingCase;
  assessment: ReadinessAssessment;
  today: ISODate;
}) {
  const { status, milestone, headline, reasons, requiredTasks, requiredCompleted } = assessment;
  const top = [...reasons].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
  const shown = top.slice(0, 3);
  const pct = requiredTasks.length === 0 ? 100 : Math.round((requiredCompleted / requiredTasks.length) * 100);

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start gap-3 border-b border-line p-5">
        <Avatar name={onboarding.employeeName} size="sm" />
        <div className="min-w-0 flex-1">
          <Link href={`/onboarding/${onboarding.id}`} className="font-medium text-ink hover:text-accent">
            {onboarding.employeeName}
          </Link>
          <p className="truncate text-xs text-muted">
            {onboarding.jobTitle} · {workflowLabel(onboarding.workflow)}
          </p>
        </div>
        <ReadinessBadge status={status} />
      </div>
      <div className="flex flex-1 flex-col p-5">
        {milestone ? (
          <p className="text-xs font-medium text-muted">
            Next milestone: <span className="text-ink">{milestone.label}</span> · {formatShortDate(milestone.date)} (
            {formatRelative(milestone.date, today)})
          </p>
        ) : null}
        <p className="mt-1 text-sm text-ink-soft">{headline}</p>
        {milestone ? (
          <div className="mt-3 flex items-center gap-2">
            <ProgressBar
              value={pct}
              label={`${onboarding.employeeName}: mandatory tasks for ${milestone.label} completed`}
              size="sm"
            />
            <span className="shrink-0 text-xs text-muted tabular-nums">
              {requiredCompleted}/{requiredTasks.length}
            </span>
          </div>
        ) : null}
        {shown.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {shown.map((r, i) => (
              <li key={`${r.kind}-${r.taskId ?? i}`} className="flex gap-2 text-xs text-ink-soft">
                {r.severity === "critical" ? (
                  <AlertOctagon aria-label="Critical" className="mt-0.5 size-3.5 shrink-0 text-red-600" />
                ) : (
                  <AlertTriangle aria-label="Warning" className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                )}
                <span>{r.message}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <Link
          href={`/onboarding/${onboarding.id}`}
          className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-accent hover:text-accent-strong"
        >
          {reasons.length > shown.length ? `See all ${reasons.length} reasons` : "Open case"}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </Card>
  );
}
