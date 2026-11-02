"use client";

import { AlertOctagon, BookCheck, BookOpenText, GraduationCap, Info, Library, UsersRound } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { DueLabel, LearningDisclaimer, progressText } from "@/components/learning/learning-ui";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress-bar";
import { diffInDays, formatLongDate } from "@/lib/dates";
import {
  assignmentProgress,
  getEmployeeLearningRows,
  getLearningSummary,
  getModuleSummaries,
  isAssignmentOverdue,
  LEARNING_KPI_DEFINITIONS,
} from "@/lib/learning";
import { getModule } from "@/lib/learning-catalog";
import { useLearning } from "@/lib/use-learning";
import { useOnboarding } from "@/lib/use-onboarding";
import type { LearningAssignment } from "@/types/learning";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

export function HrLearningView() {
  const data = useOnboarding();
  const learning = useLearning();
  const ready = data.hydrated && learning.hydrated;
  return (
    <>
      <PageHeader
        eyebrow="HR workspace"
        title="Learning"
        description={ready ? formatLongDate(data.today) : " "}
      />
      {ready ? (
        <LearningContent cases={data.cases} assignments={learning.assignments} today={data.today} />
      ) : (
        <div className="space-y-6" aria-busy="true" aria-label="Loading learning">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
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

function LearningContent({
  cases,
  assignments,
  today,
}: {
  cases: OnboardingCase[];
  assignments: LearningAssignment[];
  today: ISODate;
}) {
  const summary = getLearningSummary(assignments, today);
  const rate = summary.mandatoryCompletion;
  const rows = getEmployeeLearningRows(cases, assignments, today).sort(
    (a, b) => b.overdue - a.overdue || a.onboarding.employeeName.localeCompare(b.onboarding.employeeName),
  );
  const modules = getModuleSummaries(assignments, today);
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const overdue = assignments
    .filter((a) => isAssignmentOverdue(a, today))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  if (assignments.length === 0) {
    return (
      <Card>
        <EmptyState icon={<GraduationCap />} title="No learning assigned" description="Learning paths are created with each onboarding case." />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <LearningDisclaimer />

      <section aria-label="Learning metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <MetricCard
          label="Mandatory learning completion"
          value={rate.percent === null ? "–" : `${rate.percent}%`}
          hint={
            rate.denominator === 0
              ? "No mandatory modules due yet"
              : `${rate.numerator} of ${rate.denominator} mandatory assignments due by today`
          }
          icon={<BookCheck />}
          tone="accent"
        >
          {rate.percent !== null ? (
            <ProgressBar value={rate.percent} label="Mandatory learning completion" size="sm" className="mt-3" />
          ) : null}
        </MetricCard>
        <MetricCard
          label="Overdue assignments"
          value={summary.overdue}
          hint={`${summary.overdueMandatory} mandatory`}
          icon={<AlertOctagon />}
          tone={summary.overdue > 0 ? "danger" : "success"}
        />
        <MetricCard label="In progress" value={summary.inProgress} hint="Started, not completed, not overdue" icon={<BookOpenText />} />
        <MetricCard
          label="Completed"
          value={summary.completed}
          hint={`of ${summary.total} assignments in total`}
          icon={<GraduationCap />}
          tone="success"
        />
      </section>

      <Card aria-labelledby="learning-definitions">
        <CardHeader id="learning-definitions" title="How these figures are calculated" icon={<Info />} />
        <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
          {(
            [
              ["Mandatory learning completion", LEARNING_KPI_DEFINITIONS.mandatoryCompletion],
              ["Overdue assignments", LEARNING_KPI_DEFINITIONS.overdue],
              ["In progress", LEARNING_KPI_DEFINITIONS.inProgress],
              ["Completed", LEARNING_KPI_DEFINITIONS.completed],
            ] as const
          ).map(([term, definition]) => (
            <div key={term}>
              <dt className="font-medium text-ink">{term}</dt>
              <dd className="mt-0.5 text-muted">{definition}</dd>
            </div>
          ))}
        </dl>
        <Definition>
          Figures are calculated live from the synthetic demo data in this browser. They are illustrative and are not
          validated business results. Learning is reported separately from readiness.
        </Definition>
      </Card>

      <Card aria-labelledby="learning-overdue">
        <CardHeader
          id="learning-overdue"
          title="Overdue assignments"
          description="Not completed and past the due date"
          icon={<AlertOctagon />}
        />
        {overdue.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No learning is overdue.</p>
        ) : (
          <ul className="divide-y divide-line px-5">
            {overdue.map((a) => {
              const c = caseById.get(a.caseId);
              const learningModule = getModule(a.moduleId);
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {c ? (
                        <Link href={`/onboarding/${c.id}`} className="hover:text-accent-strong hover:underline">
                          {c.employeeName}
                        </Link>
                      ) : (
                        "Unknown case"
                      )}{" "}
                      <span className="font-normal text-muted">· {learningModule.title}</span>
                    </p>
                    <DueLabel assignment={a} today={today} />
                  </div>
                  <div className="flex items-center gap-2">
                    {a.mandatory ? <Badge tone="neutral">Mandatory</Badge> : <Badge tone="neutral">Optional</Badge>}
                    <Badge tone="danger">{Math.abs(diffInDays(today, a.dueDate))} days overdue</Badge>
                    <span className="text-xs text-muted">{progressText(assignmentProgress(a, learningModule))}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="learning-employees">
        <CardHeader
          id="learning-employees"
          title="By employee"
          description="Mandatory modules completed, overdue items and what is due next"
          icon={<UsersRound />}
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-muted">
                <th scope="col" className="px-5 py-2.5 font-medium">Employee</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Mandatory completed</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Overdue</th>
                <th scope="col" className="px-5 py-2.5 font-medium">Next due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((row) => (
                <tr key={row.onboarding.id}>
                  <th scope="row" className="px-5 py-3 text-left font-normal">
                    <Link
                      href={`/onboarding/${row.onboarding.id}`}
                      className="font-medium text-ink hover:text-accent-strong hover:underline"
                    >
                      {row.onboarding.employeeName}
                    </Link>
                    <span className="block text-xs text-muted">{row.onboarding.jobTitle}</span>
                  </th>
                  <td className="px-3 py-3">
                    <span className="tabular-nums">
                      {row.mandatoryDone} of {row.mandatoryTotal}
                    </span>
                    <ProgressBar
                      value={row.mandatoryTotal === 0 ? 0 : Math.round((row.mandatoryDone / row.mandatoryTotal) * 100)}
                      label={`${row.onboarding.employeeName} mandatory learning`}
                      size="sm"
                      className="mt-1 max-w-32"
                    />
                  </td>
                  <td className="px-3 py-3">
                    {row.overdue > 0 ? <Badge tone="danger">{row.overdue} overdue</Badge> : <span className="text-muted">–</span>}
                  </td>
                  <td className="px-5 py-3">
                    {row.next ? (
                      <>
                        <span className="text-ink">{getModule(row.next.moduleId).title}</span>
                        <span className="block">
                          <DueLabel assignment={row.next} today={today} />
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">All completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card aria-labelledby="learning-modules">
        <CardHeader id="learning-modules" title="By module" description="Assignments across all employees" icon={<Library />} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-medium text-muted">
                <th scope="col" className="px-5 py-2.5 font-medium">Module</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Assigned</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Mandatory for</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">Completed</th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">In progress</th>
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums">
              {modules.map((m) => (
                <tr key={m.module.id}>
                  <th scope="row" className="px-5 py-3 text-left font-medium text-ink">
                    {m.module.title}
                    <span className="block text-xs font-normal text-muted">
                      {m.module.lessons.length} lessons · {m.module.quiz ? `quiz, pass mark ${m.module.quiz.passMark}%` : "no quiz"}
                    </span>
                  </th>
                  <td className="px-3 py-3 text-right">{m.assigned}</td>
                  <td className="px-3 py-3 text-right">{m.mandatoryFor}</td>
                  <td className="px-3 py-3 text-right">{m.completed}</td>
                  <td className="px-3 py-3 text-right">{m.inProgress}</td>
                  <td className={m.overdue > 0 ? "px-5 py-3 text-right font-semibold text-red-700" : "px-5 py-3 text-right"}>
                    {m.overdue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
