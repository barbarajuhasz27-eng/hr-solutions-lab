"use client";

import { AlertOctagon, CalendarCheck2, CalendarClock, ClipboardCheck, Info, Lightbulb, ListTodo } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { CreateActionForm } from "@/components/feedback/create-action-form";
import { ActionCard, MeetingStatusBadge, meetingWhen, PrivacyLegend, SharedBadge } from "@/components/feedback/feedback-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader, Skeleton } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { Viewer } from "@/lib/access";
import { formatLongDate, formatShortDate } from "@/lib/dates";
import {
  FEEDBACK_KPI_DEFINITIONS,
  getFeedbackSummary,
  isActionOverdue,
  meetingTitle,
  sharedTopics,
  sortMeetings,
  surveyLabel,
  type SharedTopic,
} from "@/lib/feedback";
import { useFeedback } from "@/lib/use-feedback";
import { useOnboarding } from "@/lib/use-onboarding";
import type { FeedbackState } from "@/types/feedback";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

const HR: Viewer = { role: "hr" };

export function HrCheckInsView() {
  const data = useOnboarding();
  const feedback = useFeedback();
  const ready = data.hydrated && feedback.hydrated;
  return (
    <>
      <PageHeader eyebrow="HR workspace" title="Feedback & check-ins" description={ready ? formatLongDate(data.today) : " "} />
      {ready ? (
        <Content cases={data.cases} state={feedback.state} today={data.today} />
      ) : (
        <div className="space-y-6" aria-busy="true" aria-label="Loading check-ins">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      )}
    </>
  );
}

function Content({ cases, state, today }: { cases: OnboardingCase[]; state: FeedbackState; today: ISODate }) {
  const summary = getFeedbackSummary(cases, state, today);
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const meetings = sortMeetings(state.meetings);
  const upcoming = meetings.filter((m) => m.status === "scheduled");
  const completed = meetings.filter((m) => m.status === "completed").reverse();
  const topics = sharedTopics(state);
  const openActions = state.actions
    .filter((a) => a.status !== "Completed")
    .sort((a, b) => Number(isActionOverdue(b, today)) - Number(isActionOverdue(a, today)) || a.dueDate.localeCompare(b.dueDate));
  const p = summary.participation;

  return (
    <div className="space-y-6">
      <PrivacyLegend audience="hr" />

      <section aria-label="Feedback and check-in metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        <MetricCard
          label="Feedback participation"
          value={p.percent === null ? "–" : `${p.percent}%`}
          hint={p.denominator === 0 ? "No surveys have opened yet" : `${p.numerator} of ${p.denominator} opened surveys submitted`}
          icon={<ClipboardCheck />}
          tone="accent"
        >
          {p.percent !== null ? <ProgressBar value={p.percent} label="Feedback participation" size="sm" className="mt-3" /> : null}
        </MetricCard>
        <MetricCard label="Upcoming check-ins" value={summary.upcomingMeetings} hint="Scheduled" icon={<CalendarClock />} />
        <MetricCard label="Completed check-ins" value={summary.completedMeetings} hint="Outcome recorded" icon={<CalendarCheck2 />} tone="success" />
        <MetricCard label="Open actions" value={summary.openActions} hint="Open or in progress" icon={<ListTodo />} />
        <MetricCard
          label="Overdue actions"
          value={summary.overdueActions}
          hint="Open and past the due date"
          icon={<AlertOctagon />}
          tone={summary.overdueActions > 0 ? "danger" : "success"}
        />
      </section>

      <Card aria-labelledby="checkin-definitions">
        <CardHeader id="checkin-definitions" title="How these figures are calculated" icon={<Info />} />
        <dl className="grid gap-x-6 gap-y-3 px-5 py-4 text-sm sm:grid-cols-2">
          {(
            [
              ["Feedback participation", FEEDBACK_KPI_DEFINITIONS.participation],
              ["Upcoming check-ins", FEEDBACK_KPI_DEFINITIONS.upcoming],
              ["Completed check-ins", FEEDBACK_KPI_DEFINITIONS.completed],
              ["Open actions", FEEDBACK_KPI_DEFINITIONS.openActions],
              ["Overdue actions", FEEDBACK_KPI_DEFINITIONS.overdueActions],
            ] as const
          ).map(([term, definition]) => (
            <div key={term}>
              <dt className="font-medium text-ink">{term}</dt>
              <dd className="mt-0.5 text-muted">{definition}</dd>
            </div>
          ))}
        </dl>
        <p className="flex gap-1.5 border-t border-line bg-subtle px-5 py-3 text-xs leading-relaxed text-muted">
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Calculated live from synthetic demo data; illustrative only. This page shows no ratings or comments. Raw survey
            answers open only on an individual case page, behind an explicit HR-only step.
          </span>
        </p>
      </Card>

      <Card aria-labelledby="upcoming-checkins">
        <CardHeader id="upcoming-checkins" title="Upcoming check-ins" description="Booked by employees from fictional slots" icon={<CalendarClock />} />
        {upcoming.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No check-ins scheduled.</p>
        ) : (
          <MeetingTable meetings={upcoming} caseById={caseById} />
        )}
      </Card>

      <Card aria-labelledby="approved-topics">
        <CardHeader
          id="approved-topics"
          title="Approved discussion topics"
          description="Topics employees chose to share. Ratings and comments are not included."
          icon={<Lightbulb />}
          action={<SharedBadge />}
        />
        {topics.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No topics have been shared.</p>
        ) : (
          <ul className="divide-y divide-line">
            {topics.map((t) => (
              <TopicRow key={t.id} topic={t} onboarding={caseById.get(t.caseId)} today={today} />
            ))}
          </ul>
        )}
      </Card>

      <Card aria-labelledby="open-actions">
        <CardHeader id="open-actions" title="Open and overdue actions" description="Overdue first" icon={<ListTodo />} action={<SharedBadge />} />
        {openActions.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No open actions.</p>
        ) : (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {openActions.map((a) => (
              <ActionCard key={a.id} action={a} onboarding={caseById.get(a.caseId)} viewer={HR} today={today} showEmployee />
            ))}
          </div>
        )}
      </Card>

      <Card aria-labelledby="meeting-records">
        <CardHeader id="meeting-records" title="Meeting records" description="Completed check-ins with their agreed outcome" icon={<CalendarCheck2 />} />
        {completed.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted">No completed check-ins yet.</p>
        ) : (
          <MeetingTable meetings={completed} caseById={caseById} />
        )}
      </Card>
    </div>
  );
}

function MeetingTable({
  meetings,
  caseById,
}: {
  meetings: FeedbackState["meetings"];
  caseById: Map<string, OnboardingCase>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs font-medium text-muted">
            <th scope="col" className="px-5 py-2.5 font-medium">Employee</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Check-in</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Participants</th>
            <th scope="col" className="px-3 py-2.5 font-medium">When</th>
            <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {meetings.map((m) => {
            const c = caseById.get(m.caseId);
            return (
              <tr key={m.id}>
                <th scope="row" className="px-5 py-3 text-left font-normal">
                  {c ? (
                    <Link href={`/onboarding/${c.id}`} className="font-medium text-ink hover:text-accent-strong hover:underline">
                      {c.employeeName}
                    </Link>
                  ) : (
                    "Unknown case"
                  )}
                </th>
                <td className="px-3 py-3">
                  <Link href={`/check-ins/${m.id}`} className="text-accent hover:text-accent-strong hover:underline">
                    {meetingTitle(m)}
                  </Link>
                  <span className="block text-xs text-muted">{m.agenda.length} agenda points</span>
                </td>
                <td className="px-3 py-3 text-ink-soft">
                  {c ? c.employeeName.split(" ")[0] : "Employee"} and {m.hostName}
                </td>
                <td className="px-3 py-3 text-ink-soft">{meetingWhen(m)}</td>
                <td className="px-5 py-3">
                  <MeetingStatusBadge status={m.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TopicRow({ topic, onboarding, today }: { topic: SharedTopic; onboarding?: OnboardingCase; today: ISODate }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{topic.title}</p>
          <p className="text-xs text-muted">
            {onboarding ? (
              <Link href={`/onboarding/${onboarding.id}`} className="hover:underline">
                {onboarding.employeeName}
              </Link>
            ) : (
              "Unknown case"
            )}{" "}
            · {surveyLabel(topic.checkpoint)}
            {topic.sharedOn ? ` · shared ${formatShortDate(topic.sharedOn)}` : ""}
          </p>
          {topic.note ? <p className="mt-1 text-sm text-ink-soft">&ldquo;{topic.note}&rdquo;</p> : null}
        </div>
        <Badge tone={topic.status === "shared" ? "info" : "success"}>
          {topic.status === "shared" ? "Awaiting discussion" : "Discussed"}
        </Badge>
        {onboarding ? (
          <Button size="sm" variant="secondary" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            Agree an action<span className="sr-only"> for {topic.title}</span>
          </Button>
        ) : null}
      </div>
      {open && onboarding ? (
        <div className="mt-3">
          <CreateActionForm onboarding={onboarding} source={{ kind: "topic", topicId: topic.id }} viewer={HR} today={today} idPrefix={`topic-${topic.id}`} />
        </div>
      ) : null}
    </li>
  );
}
