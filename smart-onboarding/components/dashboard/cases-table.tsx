"use client";

import { ChevronRight, SearchX, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MilestoneStatusBadge } from "@/components/onboarding/case-badges";
import { ReadinessBadge } from "@/components/readiness/readiness-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/form-controls";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/cn";
import { formatDate, formatShortDate } from "@/lib/dates";
import {
  completionPercent,
  currentStage,
  isCaseActive,
  matchesCaseQuery,
  nextMilestone,
} from "@/lib/metrics";
import { assessReadiness } from "@/lib/readiness";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

type Scope = "Active" | "Completed" | "All";
const SCOPES: Scope[] = ["Active", "Completed", "All"];

export function CasesTable({ cases, today }: { cases: OnboardingCase[]; today: ISODate }) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("Active");

  const counts: Record<Scope, number> = {
    Active: cases.filter(isCaseActive).length,
    Completed: cases.filter((c) => !isCaseActive(c)).length,
    All: cases.length,
  };

  const rows = cases
    .filter((c) => (scope === "All" ? true : scope === "Active" ? isCaseActive(c) : !isCaseActive(c)))
    .filter((c) => matchesCaseQuery(c, query))
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map((c) => ({
      onboarding: c,
      progress: completionPercent(c.tasks),
      stage: currentStage(c),
      milestone: nextMilestone(c, today),
      readiness: assessReadiness(c, today).status,
    }));

  return (
    <Card aria-labelledby="cases-heading">
      <CardHeader
        id="cases-heading"
        icon={<Users />}
        title="Onboarding cases"
        description="Readiness, stage, progress and next milestone for each new employee."
      />
      <div className="flex flex-col gap-3 border-b border-line px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div role="group" aria-label="Filter cases by status" className="inline-flex rounded-lg bg-subtle p-1 ring-1 ring-line">
          {SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={scope === s}
              onClick={() => setScope(s)}
              className={cn(
                "rounded-md px-3 py-1 text-sm font-medium transition-colors",
                scope === s ? "bg-surface text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink",
              )}
            >
              {s} <span className="text-xs text-muted tabular-nums">{counts[s]}</span>
            </button>
          ))}
        </div>
        <SearchInput
          aria-label="Search cases by employee, role or department"
          placeholder="Search employee, role or department"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="sm:w-80"
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title={cases.length === 0 ? "No onboarding cases yet" : "No matching cases"}
          description={
            cases.length === 0
              ? "Create an onboarding case to generate its task checklist."
              : "Try a different search term or status filter."
          }
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="divide-y divide-line md:hidden">
            {rows.map(({ onboarding: c, progress, stage, milestone, readiness }) => (
              <li key={c.id}>
                <Link href={`/onboarding/${c.id}`} className="block px-5 py-4 hover:bg-subtle">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.employeeName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{c.employeeName}</p>
                      <p className="truncate text-xs text-muted">
                        {c.jobTitle} · {c.department}
                      </p>
                    </div>
                    <ReadinessBadge status={readiness} />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <ProgressBar value={progress} label={`${c.employeeName} onboarding progress`} size="sm" />
                    <span className="text-xs font-medium text-ink tabular-nums">{progress}%</span>
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Starts {formatShortDate(c.startDate)} · Stage: {stage}
                    {milestone ? ` · Next: ${milestone.label} (${formatShortDate(milestone.date)})` : ""}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-subtle text-xs font-medium tracking-wide text-muted uppercase">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Employee</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Start date</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Stage</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Progress</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Next milestone</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Readiness</th>
                  <th scope="col" className="w-10 px-3 py-2.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map(({ onboarding: c, progress, stage, milestone, readiness }) => (
                  <tr key={c.id} className="group relative hover:bg-subtle">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.employeeName} size="sm" />
                        <div className="min-w-0">
                          <Link
                            href={`/onboarding/${c.id}`}
                            className="font-medium text-ink after:absolute after:inset-0 hover:text-accent"
                          >
                            {c.employeeName}
                          </Link>
                          <p className="text-xs text-muted">
                            {c.jobTitle} · {c.department}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-ink-soft tabular-nums">
                      <time dateTime={c.startDate}>{formatDate(c.startDate)}</time>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-ink-soft">{stage}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex w-36 items-center gap-2">
                        <ProgressBar value={progress} label={`${c.employeeName} onboarding progress`} size="sm" />
                        <span className="w-9 text-right text-xs font-medium tabular-nums">{progress}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      {milestone ? (
                        <div className="flex items-center gap-2">
                          <span className="text-ink-soft">
                            {milestone.label}{" "}
                            <span className="text-muted">· {formatShortDate(milestone.date)}</span>
                          </span>
                          {milestone.status !== "Upcoming" ? (
                            <MilestoneStatusBadge status={milestone.status} />
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted">All reached</span>
                      )}
                    </td>
                    <td className="px-3 py-3.5">
                      <ReadinessBadge status={readiness} />
                    </td>
                    <td className="px-3 py-3.5 text-muted group-hover:text-ink">
                      <ChevronRight aria-hidden className="size-4" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
