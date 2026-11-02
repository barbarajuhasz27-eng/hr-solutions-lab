"use client";

import {
  AlertOctagon,
  ArrowRight,
  BookCheck,
  CalendarCheck2,
  ClipboardCheck,
  EyeOff,
  Gauge,
  GraduationCap,
  HeartHandshake,
  ListChecks,
  ListTodo,
  Route,
  ShieldCheck,
  Timer,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AnalyticsNote, DefinitionNote, formatRate, rateHint } from "@/components/experience/experience-ui";
import { BarList } from "@/components/insights/bar-list";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatLongDate } from "@/lib/dates";
import {
  BOTTLENECK_DEFINITIONS,
  EXPERIENCE_KPI_DEFINITIONS,
  getBottlenecks,
  getCheckInReport,
  getExecutiveOverview,
  getExperienceTrends,
  getLearningByCheckpoint,
  getLearningModuleReport,
  getParticipationByCheckpoint,
  MIN_GROUP_SIZE,
} from "@/lib/experience";
import { AREA_INFO } from "@/lib/feedback";
import { LEARNING_KPI_DEFINITIONS } from "@/lib/learning";
import { useFeedback } from "@/lib/use-feedback";
import { useLearning } from "@/lib/use-learning";
import { useOnboarding } from "@/lib/use-onboarding";
import { FEEDBACK_AREAS, type FeedbackState } from "@/types/feedback";
import type { LearningAssignment } from "@/types/learning";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

export function ExperienceView() {
  const data = useOnboarding();
  const learning = useLearning();
  const feedback = useFeedback();
  const ready = data.hydrated && learning.hydrated && feedback.hydrated;
  return (
    <>
      <PageHeader
        eyebrow="HR workspace"
        title="Experience & Process Intelligence"
        description={
          ready
            ? `${formatLongDate(data.today)} · Reporting cohort: all ${data.cases.length} onboarding cases in this workspace`
            : " "
        }
      />
      {ready ? (
        <ExperienceContent cases={data.cases} learning={learning.assignments} feedback={feedback.state} today={data.today} />
      ) : (
        <div className="space-y-6" aria-busy="true" aria-label="Loading reporting">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      )}
    </>
  );
}

function Section({
  id,
  title,
  description,
  icon,
  children,
}: {
  id: string;
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-strong [&_svg]:size-4" aria-hidden>
          {icon}
        </span>
        <div>
          <h2 id={id} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function ExperienceContent({
  cases,
  learning,
  feedback,
  today,
}: {
  cases: OnboardingCase[];
  learning: LearningAssignment[];
  feedback: FeedbackState;
  today: ISODate;
}) {
  const overview = getExecutiveOverview(cases, learning, feedback, today);
  const trends = getExperienceTrends(cases, feedback);
  const participation = getParticipationByCheckpoint(cases, feedback, today);
  const modules = getLearningModuleReport(cases, learning, today);
  const byCheckpoint = getLearningByCheckpoint(cases, learning, today);
  const checkIns = getCheckInReport(cases, feedback, today);
  const bottlenecks = getBottlenecks(cases, learning, feedback, today);
  const caseName = new Map(cases.map((c) => [c.id, c.employeeName]));
  const shownAreas = trends.byArea.filter((a) => a.cell.shown);
  const hiddenCheckpoints = trends.byCheckpoint.filter((g) => !g.areas["role-clarity"].shown).map((g) => g.label);
  const mix = overview.readiness.mix;

  return (
    <div className="space-y-10">
      <nav aria-label="Report sections" className="flex flex-wrap gap-2 text-sm">
        {[
          ["#exec", "Executive overview"],
          ["#experience", "Employee experience"],
          ["#learning", "Learning & development"],
          ["#checkins", "Check-ins & actions"],
          ["#bottlenecks", "Process bottlenecks"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-line bg-surface px-3 py-1 text-ink-soft hover:border-accent-ring hover:text-accent-strong">
            {label}
          </a>
        ))}
      </nav>

      {/* A. Executive overview */}
      <Section id="exec" title="Executive overview" description="Six headline figures, each with its calculation below." icon={<Gauge />}>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-3" role="group" aria-label="Headline figures">
          <MetricCard
            label="Onboarding readiness"
            value={formatRate(overview.readiness)}
            hint={`${rateHint(overview.readiness, "active onboardings Ready or On track", "No active onboardings")} · ${mix.Ready} Ready, ${mix["On track"]} On track, ${mix["At risk"]} At risk, ${mix["Not ready"]} Not ready`}
            icon={<ShieldCheck />}
            tone="accent"
          />
          <MetricCard
            label="Mandatory learning completion"
            value={formatRate(overview.mandatoryLearning)}
            hint={rateHint(overview.mandatoryLearning, "mandatory assignments due by today", "No mandatory learning due yet")}
            icon={<BookCheck />}
          />
          <MetricCard
            label="Check-in completion"
            value={formatRate(overview.checkInCompletion)}
            hint={rateHint(overview.checkInCompletion, "check-ins due by today have an agreed outcome", "No check-ins due yet")}
            icon={<CalendarCheck2 />}
          />
          <MetricCard
            label="Feedback participation"
            value={formatRate(overview.feedbackParticipation)}
            hint={rateHint(overview.feedbackParticipation, "eligible surveys submitted", "No surveys eligible yet")}
            icon={<ClipboardCheck />}
          />
          <MetricCard
            label="Action closure rate"
            value={formatRate(overview.actionClosure)}
            hint={rateHint(overview.actionClosure, "actions completed", "No actions created yet")}
            icon={<ListChecks />}
          />
          <MetricCard
            label="Overdue actions"
            value={overview.overdueActions}
            hint="Open or in progress, due before today"
            icon={<AlertOctagon />}
            tone={overview.overdueActions > 0 ? "danger" : "success"}
          />
        </div>
        <Card aria-labelledby="exec-definitions">
          <CardHeader id="exec-definitions" title="How the headline figures are calculated" />
          <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm md:grid-cols-2">
            {(
              [
                ["Onboarding readiness", EXPERIENCE_KPI_DEFINITIONS.readiness],
                ["Mandatory learning completion", EXPERIENCE_KPI_DEFINITIONS.mandatoryLearning],
                ["Check-in completion", EXPERIENCE_KPI_DEFINITIONS.checkInCompletion],
                ["Feedback participation", EXPERIENCE_KPI_DEFINITIONS.feedbackParticipation],
                ["Action closure rate", EXPERIENCE_KPI_DEFINITIONS.actionClosure],
                ["Overdue actions", EXPERIENCE_KPI_DEFINITIONS.overdueActions],
              ] as const
            ).map(([term, definition]) => (
              <div key={term}>
                <dt className="font-medium text-ink">{term}</dt>
                <dd className="mt-0.5 text-muted">{definition}</dd>
              </div>
            ))}
          </dl>
          <AnalyticsNote />
        </Card>
      </Section>

      {/* B. Employee experience */}
      <Section
        id="experience"
       
        title="Employee experience"
        description={`Pulse survey ratings (1 = strongly disagree, 5 = strongly agree). Groups with fewer than ${MIN_GROUP_SIZE} distinct employees are not shown.`}
        icon={<HeartHandshake />}
      >
        <p className="flex items-start gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-ink-soft">
          <EyeOff aria-hidden className="mt-0.5 size-4 shrink-0 text-slate-700" />
          <span>
            <strong className="font-semibold text-ink">Synthetic ratings from fictional employees.</strong> Aggregated
            ratings only: no comments, no individual ratings and no HR-only notes are used here. There are no filters or
            drill-downs, so a hidden group cannot be reconstructed from a smaller selection.
          </span>
        </p>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card aria-labelledby="area-averages" className="flex flex-col">
            <CardHeader
              id="area-averages"
              title="Average rating by experience area"
              description="All checkpoints combined · scale 1–5"
            />
            {shownAreas.length > 0 ? (
              <BarList
                caption="Average rating by experience area, all checkpoints, scale 1 to 5"
                valueHeader="Average (1–5)"
                max={5}
                rows={shownAreas.map((a) => ({
                  key: a.area,
                  label: a.label,
                  value: a.cell.shown ? a.cell.average : 0,
                  display: a.cell.shown ? a.cell.average.toFixed(1) : "",
                  detail: a.cell.shown ? `${a.cell.employees} employees` : undefined,
                }))}
              />
            ) : (
              <SuppressedState />
            )}
            {shownAreas.length > 0 && shownAreas.length < FEEDBACK_AREAS.length ? (
              <p className="px-5 pb-3 text-xs text-muted">Areas with fewer than {MIN_GROUP_SIZE} employees are not listed.</p>
            ) : null}
            <div className="mt-auto">
              <DefinitionNote>{EXPERIENCE_KPI_DEFINITIONS.areaAverages}</DefinitionNote>
              <AnalyticsNote />
            </div>
          </Card>

          <Card aria-labelledby="participation-checkpoint" className="flex flex-col">
            <CardHeader
              id="participation-checkpoint"
              title="Feedback participation by checkpoint"
              description="Submitted ÷ eligible surveys · counts only, never ratings"
            />
            <BarList
              caption="Feedback participation by checkpoint, percent of eligible surveys submitted"
              valueHeader="Participation"
              max={100}
              emptyText="No surveys are eligible yet."
              rows={participation
                .filter((p) => p.rate.denominator > 0)
                .map((p) => ({
                  key: p.checkpoint,
                  label: `${p.label} survey`,
                  value: p.rate.percent ?? 0,
                  display: formatRate(p.rate),
                  detail: `${p.rate.numerator} of ${p.rate.denominator} eligible surveys submitted`,
                }))}
            />
            {participation.some((p) => p.rate.denominator === 0) ? (
              <p className="px-5 pb-3 text-xs text-muted">
                Not yet eligible: {participation.filter((p) => p.rate.denominator === 0).map((p) => p.label).join(", ")}.
              </p>
            ) : null}
            <div className="mt-auto">
              <DefinitionNote>{EXPERIENCE_KPI_DEFINITIONS.feedbackParticipation}</DefinitionNote>
              <AnalyticsNote />
            </div>
          </Card>
        </div>

        <Card aria-labelledby="experience-trends">
          <CardHeader
            id="experience-trends"
            title="Experience trends by checkpoint"
            description="Average rating per area at Day 7, 30, 60 and 90 · scale 1–5"
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <caption className="sr-only">
                Average rating by experience area and checkpoint. Cells with fewer than {MIN_GROUP_SIZE} employees are not shown.
              </caption>
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium text-muted">
                  <th scope="col" className="px-5 py-2.5 font-medium">Experience area</th>
                  {trends.byCheckpoint.map((g) => (
                    <th key={g.checkpoint} scope="col" className="px-3 py-2.5 text-right font-medium">
                      {g.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {FEEDBACK_AREAS.map((area) => (
                  <tr key={area}>
                    <th scope="row" className="px-5 py-2.5 text-left font-medium text-ink">
                      {AREA_INFO[area].label}
                    </th>
                    {trends.byCheckpoint.map((g) => {
                      const c = g.areas[area];
                      return (
                        <td key={g.checkpoint} className="px-3 py-2.5 text-right">
                          {c.shown ? (
                            <span className="font-medium text-ink">{c.average.toFixed(1)}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-muted">
                              <EyeOff aria-hidden className="size-3.5" />
                              Not shown
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="bg-subtle text-xs text-muted">
                  <th scope="row" className="px-5 py-2 text-left font-normal">
                    Employees in group
                  </th>
                  {trends.byCheckpoint.map((g) => {
                    const c = g.areas["role-clarity"];
                    return (
                      <td key={g.checkpoint} className="px-3 py-2 text-right">
                        {c.shown ? c.employees : `Fewer than ${MIN_GROUP_SIZE}`}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
          {hiddenCheckpoints.length > 0 ? (
            <div
              role="note"
              aria-label="Groups not shown"
              className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-line bg-subtle px-3 py-2.5 text-sm text-ink-soft"
            >
              <EyeOff aria-hidden className="mt-0.5 size-4 shrink-0 text-muted" />
              <p>
                <strong className="font-semibold text-ink">
                  {hiddenCheckpoints.length === trends.byCheckpoint.length ? "No checkpoint can be shown yet" : `Not shown: ${hiddenCheckpoints.join(", ")}`}
                </strong>
                . Fewer than {MIN_GROUP_SIZE} different employees have answered{" "}
                {hiddenCheckpoints.length === 1 ? "this survey" : "these surveys"}, so no average is calculated for display. A
                group appears automatically once {MIN_GROUP_SIZE} different employees have answered.
              </p>
            </div>
          ) : null}
          <DefinitionNote>{EXPERIENCE_KPI_DEFINITIONS.experienceTrends}</DefinitionNote>
          <AnalyticsNote />
        </Card>
      </Section>

      {/* C. Learning & development */}
      <Section
        id="learning"
       
        title="Learning & development"
        description="Reported separately from readiness. Learning is not a readiness rule."
        icon={<GraduationCap />}
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <Card aria-labelledby="learning-modules-report" className="flex flex-col">
            <CardHeader
              id="learning-modules-report"
              title="Mandatory completion by module"
              description={`Overall: ${formatRate(overview.mandatoryLearning)} (${rateHint(overview.mandatoryLearning, "due by today", "nothing due yet")})`}
            />
            <BarList
              caption="Mandatory learning completion by module, percent of mandatory assignments due by today"
              valueHeader="Completion"
              max={100}
              rows={modules
                .filter((m) => m.mandatoryCompletion.denominator > 0)
                .map((m) => ({
                  key: m.module.id,
                  label: m.module.title,
                  value: m.mandatoryCompletion.percent ?? 0,
                  display: formatRate(m.mandatoryCompletion),
                  detail: `${m.mandatoryCompletion.numerator} of ${m.mandatoryCompletion.denominator} due by today · ${m.overdueMandatory} overdue`,
                }))}
              emptyText="No mandatory learning is due yet."
            />
            {modules.some((m) => m.mandatoryCompletion.denominator === 0) ? (
              <p className="px-5 pb-3 text-xs text-muted">
                No mandatory assignments due yet: {modules.filter((m) => m.mandatoryCompletion.denominator === 0).map((m) => m.module.title).join(", ")}.
              </p>
            ) : null}
            <div className="mt-auto">
              <DefinitionNote>{LEARNING_KPI_DEFINITIONS.mandatoryCompletion}</DefinitionNote>
              <AnalyticsNote />
            </div>
          </Card>

          <Card aria-labelledby="learning-checkpoints" className="flex flex-col">
            <CardHeader id="learning-checkpoints" title="Learning progress by checkpoint" description="All assignments, mandatory and optional, by status" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Learning assignments by checkpoint and status</caption>
                <thead>
                  <tr className="border-b border-line text-left text-xs font-medium text-muted">
                    <th scope="col" className="px-5 py-2.5 font-medium">Checkpoint</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">Assigned</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">Completed</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">In progress</th>
                    <th scope="col" className="px-2 py-2.5 text-right font-medium">Overdue</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Not started</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line tabular-nums">
                  {byCheckpoint.map((r) => (
                    <tr key={r.checkpoint}>
                      <th scope="row" className="px-5 py-2.5 text-left font-medium text-ink">
                        {r.label}
                      </th>
                      <td className="px-2 py-2.5 text-right">{r.assigned}</td>
                      <td className="px-2 py-2.5 text-right">{r.completed}</td>
                      <td className="px-2 py-2.5 text-right">{r.inProgress}</td>
                      <td className={r.overdue > 0 ? "px-2 py-2.5 text-right font-semibold text-red-700" : "px-2 py-2.5 text-right"}>{r.overdue}</td>
                      <td className="px-5 py-2.5 text-right">{r.notStarted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-5 pt-3 text-sm text-ink-soft">
              In progress now: <strong className="font-semibold text-ink">{byCheckpoint.reduce((s, r) => s + r.inProgress, 0)}</strong>{" "}
              assignments.{" "}
              <Link href="/learning" className="font-medium text-accent hover:underline">
                Open the learning overview
              </Link>
            </p>
            <div className="mt-auto pt-3">
              <DefinitionNote>
                Each assignment has one status: Completed, Overdue (open and due before today), In progress (started, not
                overdue) or Not started.
              </DefinitionNote>
              <AnalyticsNote />
            </div>
          </Card>
        </div>
      </Section>

      {/* D. Check-ins & actions */}
      <Section id="checkins" title="Check-ins & actions" description="The feedback-to-action loop: check-ins held, actions agreed, and whether they closed." icon={<ListTodo />}>
        <Card aria-labelledby="checkin-report">
          <CardHeader id="checkin-report" title="Check-ins and action plans" description="All check-ins and actions in the reporting cohort" />
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 text-sm sm:grid-cols-4">
            <Stat term="Check-in completion" value={formatRate(checkIns.completion)} detail={rateHint(checkIns.completion, "due by today", "None due yet")} />
            <Stat term="Upcoming check-ins" value={checkIns.upcoming} detail="Scheduled after today" />
            <Stat term="Completed check-ins" value={checkIns.completed} detail="With an agreed outcome" />
            <Stat term="Awaiting an outcome" value={checkIns.awaitingOutcome} detail="Held or due, outcome not recorded" />
            <Stat term="Action closure rate" value={formatRate(checkIns.closure)} detail={rateHint(checkIns.closure, "actions completed", "No actions yet")} />
            <Stat term="Open actions" value={checkIns.openActions} detail="Open or in progress" />
            <Stat term="Overdue actions" value={checkIns.overdueActions} detail="Due before today" danger={checkIns.overdueActions > 0} />
            <Stat term="Reopened actions" value={checkIns.reopenedActions} detail="Reopened at least once after “did not help”" />
          </dl>
          {checkIns.closure.percent !== null ? (
            <div className="px-5 pb-4">
              <ProgressBar value={checkIns.closure.percent} label="Action closure rate" size="sm" />
            </div>
          ) : null}
          <p className="px-5 pb-3 text-sm">
            <Link href="/check-ins" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
              Open check-ins and action plans
              <ArrowRight aria-hidden className="size-4" />
            </Link>
          </p>
          <DefinitionNote>
            {EXPERIENCE_KPI_DEFINITIONS.checkInCompletion} {EXPERIENCE_KPI_DEFINITIONS.actionClosure}
          </DefinitionNote>
          <AnalyticsNote />
        </Card>
      </Section>

      {/* E. Process bottlenecks */}
      <Section
        id="bottlenecks"
       
        title="Process bottlenecks"
        description="Where work is currently late or stuck. These figures show where to look, not why it happened."
        icon={<Route />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Bottleneck
            id="bn-owner"
            title="Overdue onboarding tasks by owner"
            definition={BOTTLENECK_DEFINITIONS.overdueTasksByOwner}
            meaning="Tasks a team has not completed by their due date. Several overdue tasks for one owner may point to capacity or hand-off issues in that team's part of the process."
            area="Task ownership and planning"
            href="/tasks"
            linkText="Open all tasks"
            empty="No overdue onboarding tasks."
            items={bottlenecks.overdueTasksByOwner.map((o) => ({ key: o.owner, label: o.owner, value: `${o.overdue} overdue`, detail: `of ${o.open} open` }))}
          />
          <Bottleneck
            id="bn-learning"
            title="Overdue mandatory learning by module"
            definition={BOTTLENECK_DEFINITIONS.overdueLearning}
            meaning="Mandatory modules not finished by their checkpoint. Repeated overdue items for one module may suggest its timing or length is worth reviewing."
            area="Learning schedule"
            href="/learning"
            linkText="Open the learning overview"
            empty="No mandatory learning is overdue."
            items={bottlenecks.overdueLearningByModule.map((m) => ({ key: m.moduleId, label: m.title, value: `${m.overdue} overdue` }))}
          />
          <Bottleneck
            id="bn-checkins"
            title="Check-ins due but not yet booked"
            definition={BOTTLENECK_DEFINITIONS.checkInsNotBooked}
            meaning="An employee has something to discuss, or has reached Day 30 without a conversation, and nothing is booked yet."
            area="Check-in scheduling"
            href="/check-ins"
            linkText="Open check-ins"
            empty="Every onboarding with a waiting topic or past Day 30 has a check-in."
            items={bottlenecks.checkInGaps.map((g) => ({
              key: g.caseId,
              label: g.employeeName,
              href: `/onboarding/${g.caseId}`,
              value: g.reason === "shared-topic-waiting" ? "Shared topic, no check-in scheduled" : "Past Day 30, no check-in",
            }))}
          />
          <Bottleneck
            id="bn-actions"
            title="Recurring unresolved actions"
            definition={BOTTLENECK_DEFINITIONS.unresolvedActions}
            meaning="The first attempt did not help and the action is open again. This may mean the action did not address the underlying need."
            area="Action planning and follow-up"
            href="/check-ins"
            linkText="Open action plans"
            empty="No reopened actions are open."
            items={bottlenecks.unresolvedActions.map((a) => ({
              key: a.id,
              label: caseName.get(a.caseId) ?? "Unknown case",
              href: `/onboarding/${a.caseId}`,
              value: `${a.description} · reopened ${a.reopenCount}×${a.overdue ? " · overdue" : ""}`,
            }))}
          />
        </div>
        <Card aria-labelledby="bn-stages">
          <CardHeader id="bn-stages" title="Delays across onboarding stages" description="Overdue tasks per stage and the share of already-due tasks completed" icon={<Timer />} />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-sm">
              <caption className="sr-only">Overdue tasks and due-task completion by onboarding stage</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs font-medium text-muted">
                  <th scope="col" className="px-5 py-2.5 font-medium">Stage</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Overdue tasks</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Due tasks completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line tabular-nums">
                {bottlenecks.stageDelays.map((s) => (
                  <tr key={s.stage}>
                    <th scope="row" className="px-5 py-2.5 text-left font-medium text-ink">
                      {s.stage}
                    </th>
                    <td className={s.overdue > 0 ? "px-3 py-2.5 text-right font-semibold text-red-700" : "px-3 py-2.5 text-right"}>{s.overdue}</td>
                    <td className="px-5 py-2.5 text-right">{s.dueCompletion === null ? "No tasks due yet" : `${s.dueCompletion}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="px-5 pt-3 text-sm text-ink-soft">
            <strong className="font-semibold text-ink">What it means:</strong> a stage with several overdue tasks is where the
            onboarding flow is currently slowest. <strong className="font-semibold text-ink">Process area:</strong> stage
            planning and dependencies.{" "}
            <Link href="/insights" className="font-medium text-accent hover:underline">
              Open process insights
            </Link>
          </p>
          <DefinitionNote>{BOTTLENECK_DEFINITIONS.stageDelays}</DefinitionNote>
          <AnalyticsNote />
        </Card>
        <p className="text-xs text-muted">
          These are descriptive counts from current data. They do not establish causes, and co-occurring figures should not be
          read as one causing the other.
        </p>
      </Section>
    </div>
  );
}

function SuppressedState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 py-8 text-center">
      <EyeOff aria-hidden className="size-6 text-muted" />
      <p className="text-sm font-medium text-ink">Not enough responses to show yet</p>
      <p className="max-w-sm text-sm text-muted">
        Averages appear once at least {MIN_GROUP_SIZE} different employees have answered, so that no individual&apos;s
        answers can be identified. Until then, nothing about these ratings is displayed.
      </p>
    </div>
  );
}

function Stat({ term, value, detail, danger = false }: { term: string; value: ReactNode; detail: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-muted">{term}</dt>
      <dd className={danger ? "text-2xl font-semibold text-red-700 tabular-nums" : "text-2xl font-semibold text-ink tabular-nums"}>{value}</dd>
      <dd className="text-xs text-muted">{detail}</dd>
    </div>
  );
}

function Bottleneck({
  id,
  title,
  definition,
  meaning,
  area,
  href,
  linkText,
  empty,
  items,
}: {
  id: string;
  title: string;
  definition: string;
  meaning: string;
  area: string;
  href: string;
  linkText: string;
  empty: string;
  items: { key: string; label: string; value: string; detail?: string; href?: string }[];
}) {
  return (
    <Card aria-labelledby={id} className="flex flex-col">
      <CardHeader
        id={id}
        title={title}
        action={items.length > 0 ? <Badge tone="warning">{items.length}</Badge> : <Badge tone="success">None</Badge>}
      />
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-line px-5">
          {items.map((i) => (
            <li key={i.key} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 text-sm">
              {i.href ? (
                <Link href={i.href} className="font-medium text-ink hover:text-accent-strong hover:underline">
                  {i.label}
                </Link>
              ) : (
                <span className="font-medium text-ink">{i.label}</span>
              )}
              <span className="text-ink-soft">
                {i.value}
                {i.detail ? <span className="text-muted"> {i.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-auto space-y-1 px-5 py-3 text-sm text-ink-soft">
        <p>
          <strong className="font-semibold text-ink">What it means:</strong> {meaning}
        </p>
        <p>
          <strong className="font-semibold text-ink">Process area that may need attention:</strong> {area}.{" "}
          <Link href={href} className="font-medium text-accent hover:underline">
            {linkText}
          </Link>
        </p>
      </div>
      <DefinitionNote>{definition}</DefinitionNote>
      <AnalyticsNote />
    </Card>
  );
}
