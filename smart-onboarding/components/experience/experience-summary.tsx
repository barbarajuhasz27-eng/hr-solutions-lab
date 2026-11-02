"use client";

import { AlertOctagon, ArrowRight, BookCheck, CalendarCheck2, ClipboardCheck, HeartPulse } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { AnalyticsNote, formatRate, rateHint } from "@/components/experience/experience-ui";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { getBottlenecks, getExecutiveOverview } from "@/lib/experience";
import { useFeedback } from "@/lib/use-feedback";
import { useLearning } from "@/lib/use-learning";
import { useOnboarding } from "@/lib/use-onboarding";

/**
 * Compact Experience & Process Intelligence summary for the dashboard, insights and readiness
 * pages. Shows operational rates only; experience ratings stay on /experience behind the
 * small-group rule.
 */
export function ExperienceSummary({ variant }: { variant: "dashboard" | "insights" | "readiness" }) {
  const data = useOnboarding();
  const learning = useLearning();
  const feedback = useFeedback();

  if (!data.hydrated || !learning.hydrated || !feedback.hydrated || !learning.assignments || !feedback.state) {
    return <Skeleton className="h-40 rounded-xl" />;
  }

  const o = getExecutiveOverview(data.cases, learning.assignments, feedback.state, data.today);

  if (variant === "dashboard") {
    return (
      <section aria-labelledby="experience-tiles" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="experience-tiles" className="text-base font-semibold text-ink">
            Experience & process intelligence
          </h2>
          <Link href="/experience" className="inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            Open the full report
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <TileLink label="Mandatory learning completion" value={formatRate(o.mandatoryLearning)} hint={rateHint(o.mandatoryLearning, "due by today", "Nothing due yet")} icon={<BookCheck />} />
          <TileLink label="Check-in completion" value={formatRate(o.checkInCompletion)} hint={rateHint(o.checkInCompletion, "due by today", "None due yet")} icon={<CalendarCheck2 />} />
          <TileLink label="Feedback participation" value={formatRate(o.feedbackParticipation)} hint={rateHint(o.feedbackParticipation, "eligible surveys", "None eligible yet")} icon={<ClipboardCheck />} />
          <TileLink label="Overdue actions" value={String(o.overdueActions)} hint={`Action closure: ${formatRate(o.actionClosure)}`} icon={<AlertOctagon />} danger={o.overdueActions > 0} />
        </div>
        <p className="text-xs text-muted">
          Calculated from synthetic demonstration data. Illustrative only — not validated business performance results.
        </p>
      </section>
    );
  }

  const b = getBottlenecks(data.cases, learning.assignments, feedback.state, data.today);
  const items =
    variant === "readiness"
      ? [
          { label: "Mandatory learning overdue", value: b.overdueLearningByModule.reduce((s, m) => s + m.overdue, 0) },
          { label: "Check-ins due but not booked", value: b.checkInGaps.length },
          { label: "Overdue actions", value: o.overdueActions },
        ]
      : [
          { label: "Owners with overdue tasks", value: b.overdueTasksByOwner.length },
          { label: "Modules with overdue mandatory learning", value: b.overdueLearningByModule.length },
          { label: "Check-ins due but not booked", value: b.checkInGaps.length },
          { label: "Recurring unresolved actions", value: b.unresolvedActions.length },
        ];

  return (
    <Card aria-labelledby={`experience-${variant}`}>
      <CardHeader
        id={`experience-${variant}`}
        icon={<HeartPulse />}
        title="Experience & Process Intelligence"
        description={
          variant === "readiness"
            ? "Signals beside readiness. They are reported separately and do not change any readiness status."
            : "Learning, feedback and the action loop, next to the process figures above."
        }
      />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 text-sm sm:grid-cols-4">
        {variant === "insights" ? (
          <>
            <Figure term="Mandatory learning completion" value={formatRate(o.mandatoryLearning)} />
            <Figure term="Check-in completion" value={formatRate(o.checkInCompletion)} />
            <Figure term="Feedback participation" value={formatRate(o.feedbackParticipation)} />
            <Figure term="Action closure rate" value={formatRate(o.actionClosure)} />
          </>
        ) : null}
        {items.map((i) => (
          <Figure key={i.label} term={i.label} value={String(i.value)} danger={i.value > 0} />
        ))}
      </dl>
      <p className="px-5 pb-3 text-sm">
        <Link href={variant === "readiness" ? "/experience#bottlenecks" : "/experience"} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
          {variant === "readiness" ? "See the bottlenecks with definitions" : "Open Experience & Process Intelligence"}
          <ArrowRight aria-hidden className="size-4" />
        </Link>
      </p>
      <AnalyticsNote />
    </Card>
  );
}

function Figure({ term, value, danger = false }: { term: string; value: string; danger?: boolean }) {
  return (
    <div>
      <dt className="text-muted">{term}</dt>
      <dd className={danger ? "text-xl font-semibold text-red-700 tabular-nums" : "text-xl font-semibold text-ink tabular-nums"}>{value}</dd>
    </div>
  );
}

function TileLink({
  label,
  value,
  hint,
  icon,
  danger = false,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  danger?: boolean;
}) {
  return (
    <Link href="/experience" className="rounded-xl outline-offset-2 focus-visible:outline-2" aria-label={`${label}: ${value}. ${hint}. Open Experience & Process Intelligence`}>
      <MetricCard label={label} value={value} hint={hint} icon={icon} tone={danger ? "danger" : "neutral"} />
    </Link>
  );
}
