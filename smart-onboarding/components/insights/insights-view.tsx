"use client";

import {
  ArrowRightLeft,
  BarChart3,
  FlaskConical,
  Info,
  Layers,
  RefreshCcw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExperienceSummary } from "@/components/experience/experience-summary";
import { BarList } from "@/components/insights/bar-list";
import { READINESS_ICON } from "@/components/readiness/readiness-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/dates";
import {
  getBlockerPatterns,
  getCompletionByStage,
  getDay1Readiness,
  getHandoverSummary,
  getOverdueByOwner,
  getReadinessMix,
  getStakeholderDistribution,
  KPI_DEFINITIONS,
} from "@/lib/process-intelligence";
import { READINESS_STATUSES, type ReadinessStatus } from "@/lib/readiness";
import { useOnboarding } from "@/lib/use-onboarding";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

export function InsightsView() {
  const state = useOnboarding();
  return (
    <>
      <PageHeader
        eyebrow="Process intelligence"
        title="Onboarding process insights"
        description="Aggregate patterns across all onboarding cases: readiness, stage completion, team workload, handovers and blockers."
      />
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
        <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-700" />
        <p>
          <strong className="font-semibold">Illustrative insights from synthetic demo data.</strong> Every figure
          is calculated live from the fictional cases in this browser. They are not validated business results
          and do not indicate savings, productivity or retention effects.
        </p>
      </div>
      {state.hydrated ? (
        <InsightsContent cases={state.cases} today={state.today} />
      ) : (
        <div className="space-y-6" aria-busy="true" aria-label="Loading insights">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-72 rounded-xl" />
        </div>
      )}
    </>
  );
}

function Definition({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-1.5 border-t border-line bg-subtle px-5 py-3 text-xs leading-relaxed text-muted">
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <span className="font-semibold text-ink-soft">Definition: </span>
        {children}
      </span>
    </p>
  );
}

function KpiTile({
  label,
  value,
  context,
  definition,
}: {
  label: string;
  value: string;
  context: string;
  definition: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-col rounded-xl border border-line bg-surface shadow-card">
      <div className="flex-1 p-4 sm:p-5">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{value}</p>
        <p className="mt-1 text-xs text-muted">{context}</p>
      </div>
      <details className="border-t border-line text-xs text-muted">
        <summary className="cursor-pointer px-4 py-2 font-medium hover:text-ink sm:px-5">How it is calculated</summary>
        <p className="px-4 pb-3 leading-relaxed sm:px-5">{definition}</p>
      </details>
    </div>
  );
}

const MIX_FILL: Record<ReadinessStatus, string> = {
  "Not ready": "bg-red-600",
  "At risk": "bg-amber-500",
  "On track": "bg-sky-600",
  Ready: "bg-emerald-600",
};

function InsightsContent({ cases, today }: { cases: OnboardingCase[]; today: ISODate }) {
  if (cases.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={<BarChart3 />}
          title="No onboarding cases to analyse"
          description="Create a case or reset the demo data to see process insights."
        />
      </Card>
    );
  }

  const day1 = getDay1Readiness(cases, today);
  const mix = getReadinessMix(cases, today);
  const activeTotal = READINESS_STATUSES.reduce((n, s) => n + mix[s], 0);
  const stages = getCompletionByStage(cases, today);
  const overdue = getOverdueByOwner(cases, today);
  const handovers = getHandoverSummary(cases, today);
  const blockers = getBlockerPatterns(cases);
  const recurring = blockers.filter((b) => b.recurring);
  const distribution = getStakeholderDistribution(cases, today);
  const totalTasks = distribution.reduce((n, d) => n + d.total, 0);

  return (
    <div className="space-y-6">
      <section aria-label="Headline process KPIs" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Day 1 readiness rate"
          value={day1.rate === null ? "—" : `${day1.rate}%`}
          context={`${day1.ready} of ${day1.eligible} started cases were fully ready on Day 1`}
          definition={KPI_DEFINITIONS.day1Readiness}
        />
        <KpiTile
          label="Active cases not ready"
          value={String(mix["Not ready"])}
          context={`of ${activeTotal} active cases · ${mix["At risk"]} more at risk`}
          definition={KPI_DEFINITIONS.readinessMix}
        />
        <KpiTile
          label="Delayed handovers"
          value={String(handovers.delayed)}
          context={`of ${handovers.evaluated} cross-team handovers due so far${
            handovers.averageDelayDays !== null ? ` · avg ${handovers.averageDelayDays} days late` : ""
          }`}
          definition={KPI_DEFINITIONS.handoverDelays}
        />
        <KpiTile
          label="Recurring blockers"
          value={String(recurring.length)}
          context={`task types blocked in 2+ cases · ${blockers.length} task types blocked at least once`}
          definition={KPI_DEFINITIONS.recurringBlockers}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Readiness mix: one whole split into four parts */}
        <Card aria-labelledby="mix-heading" className="flex flex-col">
          <CardHeader id="mix-heading" icon={<ShieldCheck />} title="Readiness of active cases" description={`${activeTotal} active onboardings by current readiness status.`} />
          <div className="flex-1 px-5 py-4">
            <div
              className="flex h-2 gap-0.5 overflow-hidden rounded-full"
              role="img"
              aria-label={READINESS_STATUSES.map((s) => `${s}: ${mix[s]}`).join(", ")}
            >
              {READINESS_STATUSES.filter((s) => mix[s] > 0).map((s) => (
                <span key={s} className={cn("h-full first:rounded-l-full last:rounded-r-full", MIX_FILL[s])} style={{ flexGrow: mix[s] }} />
              ))}
            </div>
            <ul className="mt-4 grid grid-cols-2 gap-3">
              {READINESS_STATUSES.map((s) => {
                const Icon = READINESS_ICON[s];
                return (
                  <li key={s}>
                    <Link
                      href={`/readiness?status=${encodeURIComponent(s)}`}
                      className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-subtle"
                    >
                      <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full", MIX_FILL[s])} />
                      <Icon aria-hidden className="size-4 text-muted" />
                      <span className="text-ink-soft">{s}</span>
                      <span className="ml-auto font-semibold text-ink tabular-nums">{mix[s]}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {day1.notReadyCases.length > 0 ? (
              <div className="mt-4 rounded-lg bg-subtle p-3 text-xs ring-1 ring-line">
                <p className="font-semibold text-ink">Started without full Day 1 readiness</p>
                <ul className="mt-1.5 space-y-1 text-muted">
                  {day1.notReadyCases.map((c) => (
                    <li key={c.caseId}>
                      <Link href={`/onboarding/${c.caseId}`} className="font-medium text-accent hover:underline">
                        {c.employeeName}
                      </Link>
                      : {c.missing.map((t) => t.title).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <Definition>{KPI_DEFINITIONS.readinessMix}</Definition>
        </Card>

        <Card aria-labelledby="stage-heading" className="flex flex-col">
          <CardHeader id="stage-heading" icon={<Layers />} title="Completion by stage" description="Share of already-due tasks completed in each stage." />
          <div className="flex-1">
            <BarList
              caption="Completion of due tasks by stage"
              valueHeader="Completed"
              max={100}
              rows={stages.map((s) => ({
                key: s.stage,
                label: s.stage,
                value: s.rate ?? 0,
                display: s.rate === null ? "—" : `${s.rate}%`,
                detail:
                  s.dueTasks === 0
                    ? `Nothing due yet · ${s.totalTasks} tasks scheduled`
                    : `${s.dueCompleted} of ${s.dueTasks} due tasks completed · ${s.totalTasks} tasks in total`,
              }))}
            />
          </div>
          <Definition>{KPI_DEFINITIONS.completionByStage}</Definition>
        </Card>

        <Card aria-labelledby="overdue-heading" className="flex flex-col">
          <CardHeader id="overdue-heading" icon={<UsersRound />} title="Overdue tasks by owner" description="Where open work has slipped past its due date." />
          <div className="flex-1">
            <BarList
              caption="Overdue tasks by owning team"
              valueHeader="Overdue"
              rows={overdue.map((o) => ({
                key: o.owner,
                label: o.owner,
                value: o.overdue,
                display: String(o.overdue),
                detail: `${o.open} open${o.overdueShare !== null ? ` · ${o.overdueShare}% of open tasks overdue` : ""}`,
              }))}
            />
          </div>
          <Definition>{KPI_DEFINITIONS.overdueByOwner}</Definition>
        </Card>

        <Card aria-labelledby="handover-heading" className="flex flex-col">
          <CardHeader
            id="handover-heading"
            icon={<ArrowRightLeft />}
            title="Handover delays"
            description="Cross-team dependencies where the upstream team finished late."
            action={handovers.ongoing > 0 ? <Badge tone="danger">{handovers.ongoing} still open</Badge> : null}
          />
          <div className="flex-1">
            <BarList
              caption="Delayed handovers by route"
              valueHeader="Delayed"
              emptyText="No cross-team handovers are due yet."
              rows={handovers.routes.map((r) => ({
                key: r.route,
                label: r.route,
                value: r.delayed,
                display: `${r.delayed}/${r.handovers}`,
                detail:
                  r.averageDelayDays !== null
                    ? `${r.delayed} of ${r.handovers} delayed · avg ${r.averageDelayDays} days late`
                    : `${r.handovers} handovers, none delayed`,
              }))}
            />
            {handovers.delayedHandovers.length > 0 ? (
              <div className="border-t border-line px-5 py-3">
                <p className="text-xs font-semibold text-ink">Longest delays</p>
                <ul className="mt-1.5 space-y-1 text-xs text-muted">
                  {handovers.delayedHandovers.slice(0, 4).map((h) => (
                    <li key={`${h.caseId}-${h.prerequisite.id}-${h.dependent.id}`}>
                      <Link href={`/onboarding/${h.caseId}#task-${h.prerequisite.id}`} className="font-medium text-accent hover:underline">
                        {h.employeeName}
                      </Link>
                      : “{h.prerequisite.title}” ({h.from}) → “{h.dependent.title}” ({h.to}) ·{" "}
                      <span className="font-medium text-ink">
                        {h.delayDays} days {h.ongoing ? "and counting" : "late"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <Definition>{KPI_DEFINITIONS.handoverDelays}</Definition>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card aria-labelledby="blockers-heading" className="flex flex-col lg:col-span-3">
          <CardHeader id="blockers-heading" icon={<RefreshCcw />} title="Recurring blockers" description="Task types that have been blocked, now or previously, grouped across cases." />
          {blockers.length === 0 ? (
            <EmptyState title="No blockers recorded" description="No task has been blocked in any case." className="flex-1" />
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Blocked task types across cases</caption>
                <thead className="bg-subtle text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th scope="col" className="px-5 py-2.5 font-medium">Task</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Cases</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Blocked now</th>
                    <th scope="col" className="px-5 py-2.5 font-medium">Recorded reasons</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {blockers.map((b) => (
                    <tr key={b.templateKey}>
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink">{b.title}</p>
                        <p className="text-xs text-muted">
                          {b.owner} · {b.employees.join(", ")}
                        </p>
                        {b.recurring ? (
                          <Badge tone="warning" className="mt-1">
                            Recurring
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums">{b.casesAffected}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{b.currentlyBlocked}</td>
                      <td className="px-5 py-3 text-xs text-muted">{b.reasons.length > 0 ? b.reasons.join("; ") : "No reason recorded"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Definition>{KPI_DEFINITIONS.recurringBlockers}</Definition>
        </Card>

        <Card aria-labelledby="distribution-heading" className="flex flex-col lg:col-span-2">
          <CardHeader id="distribution-heading" icon={<BarChart3 />} title="Task distribution" description={`${totalTasks} tasks across stakeholders, largest share first.`} />
          <div className="flex-1">
            <BarList
              caption="Task distribution across stakeholders"
              valueHeader="Tasks"
              rows={distribution.map((d) => ({
                key: d.owner,
                label: d.owner,
                value: d.total,
                display: String(d.total),
                detail: `${d.shareOfTotal}% of all tasks · ${d.open} open`,
              }))}
            />
          </div>
          <Definition>{KPI_DEFINITIONS.stakeholderDistribution}</Definition>
        </Card>
      </div>

      <ExperienceSummary variant="insights" />

      <p className="text-xs text-muted">
        Calculated on {formatShortDate(today)} from {cases.length} synthetic cases. Figures change as tasks are
        updated and reset with the demo data.
      </p>
    </div>
  );
}
