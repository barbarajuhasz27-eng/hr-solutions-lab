"use client";

import { AlertOctagon, CalendarClock, Gauge, Plus, UsersRound } from "lucide-react";
import { CasesTable } from "@/components/dashboard/cases-table";
import { MetricCard } from "@/components/dashboard/metric-card";
import { ExperienceSummary } from "@/components/experience/experience-summary";
import { UpcomingStarts } from "@/components/dashboard/upcoming-starts";
import { CriticalTasksList } from "@/components/readiness/critical-tasks-list";
import { ReadinessOverview } from "@/components/readiness/readiness-overview";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatLongDate } from "@/lib/dates";
import { getDashboardMetrics, getUpcomingStarts, isCaseActive } from "@/lib/metrics";
import { countByReadiness, getCriticalTasks } from "@/lib/readiness";
import { useOnboarding } from "@/lib/use-onboarding";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

export function DashboardView() {
  const state = useOnboarding();

  return (
    <>
      <PageHeader
        eyebrow="People Operations Workspace"
        title="Onboarding readiness"
        description={state.hydrated ? formatLongDate(state.today) : " "}
        actions={
          <ButtonLink href="/onboarding/new">
            <Plus aria-hidden />
            New onboarding
          </ButtonLink>
        }
      />
      {state.hydrated ? <DashboardContent cases={state.cases} today={state.today} /> : <DashboardSkeleton />}
    </>
  );
}

function DashboardContent({ cases, today }: { cases: OnboardingCase[]; today: ISODate }) {
  const metrics = getDashboardMetrics(cases, today);
  const active = cases.filter(isCaseActive);
  const readiness = countByReadiness(active, today);
  const critical = getCriticalTasks(cases, today);
  const upcoming = getUpcomingStarts(cases, today);

  return (
    <div className="space-y-6">
      <ReadinessOverview counts={readiness} activeCases={active.length} />

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Upcoming starts"
          value={metrics.upcomingStarts}
          hint="Next 30 days"
          icon={<CalendarClock />}
          tone="accent"
        />
        <MetricCard
          label="Active onboardings"
          value={metrics.activeOnboardings}
          hint={`${cases.length} ${cases.length === 1 ? "case" : "cases"} in total`}
          icon={<UsersRound />}
        />
        <MetricCard
          label="Tasks overdue"
          value={metrics.overdueTasks}
          hint={`${metrics.blockedTasks} blocked`}
          icon={<AlertOctagon />}
          tone={metrics.overdueTasks > 0 ? "danger" : "success"}
        />
        <MetricCard
          label="Overall task completion"
          value={`${metrics.overallCompletion}%`}
          hint={`${metrics.completedTasks} of ${metrics.totalTasks} tasks completed`}
          icon={<Gauge />}
          tone="success"
        >
          <ProgressBar value={metrics.overallCompletion} label="Overall task completion" size="sm" className="mt-3" />
        </MetricCard>
      </section>

      <ExperienceSummary variant="dashboard" />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <CriticalTasksList items={critical} today={today} limit={6} />
        </div>
        <div className="lg:col-span-2">
          <UpcomingStarts cases={upcoming} today={today} />
        </div>
      </div>

      <CasesTable cases={cases} today={today} />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-36 rounded-xl" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-4 h-8 w-16" />
            <Skeleton className="mt-3 h-3 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-5">
        <Skeleton className="h-72 rounded-xl lg:col-span-3" />
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
