"use client";

import { ArrowRight, CalendarPlus, CalendarDays, ClipboardList, Lightbulb, ListTodo, Lock, UserX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  ActionCard,
  ConfidentialBadge,
  MeetingStatusBadge,
  meetingWhen,
  PrivacyLegend,
  SharedBadge,
} from "@/components/feedback/feedback-ui";
import { PortalSkeleton } from "@/components/portal/portal-home-view";
import { usePortalCase } from "@/components/portal/use-portal-case";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import type { Viewer } from "@/lib/access";
import { formatDate, formatShortDate } from "@/lib/dates";
import {
  actionsForCase,
  getSurveys,
  isTopicInUse,
  meetingTitle,
  sortMeetings,
  surveyLabel,
  TOPIC_NOTE_MAX_LENGTH,
  topicTitle,
  type SurveyState,
} from "@/lib/feedback";
import { firstName } from "@/lib/portal";
import { feedbackActions, useFeedback } from "@/lib/use-feedback";
import type { DiscussionTopic, FeedbackState } from "@/types/feedback";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

const SURVEY_TONE: Record<SurveyState, Tone> = { open: "accent", submitted: "success", upcoming: "neutral", closed: "neutral" };
const SURVEY_LABEL: Record<SurveyState, string> = { open: "Open", submitted: "Submitted", upcoming: "Upcoming", closed: "Closed" };

export function PortalFeedbackView() {
  const portal = usePortalCase();
  const feedback = useFeedback();
  if (portal.status === "loading" || !feedback.hydrated) return <PortalSkeleton />;
  if (portal.status === "empty") {
    return (
      <Card>
        <EmptyState icon={<UserX />} title="No onboarding to preview" description="There are no onboarding cases in this browser." />
      </Card>
    );
  }
  return (
    <FeedbackHub onboarding={portal.onboarding} viewer={portal.viewer} today={portal.today} state={feedback.state} />
  );
}

function FeedbackHub({
  onboarding,
  viewer,
  today,
  state,
}: {
  onboarding: OnboardingCase;
  viewer: Viewer;
  today: ISODate;
  state: FeedbackState;
}) {
  const surveys = getSurveys(onboarding, state.responses, today);
  const topics = state.topics.filter((t) => t.caseId === onboarding.id);
  const meetings = sortMeetings(state.meetings.filter((m) => m.caseId === onboarding.id));
  const upcoming = meetings.filter((m) => m.status === "scheduled");
  const past = meetings.filter((m) => m.status !== "scheduled").reverse();
  const actions = actionsForCase(state, onboarding.id);

  return (
    <>
      <PageHeader
        eyebrow={`${firstName(onboarding.employeeName)}'s check-ins`}
        title="Feedback & check-ins"
        description="Short pulse surveys at Day 7, 30, 60 and 90, check-ins you can book, and the actions you agree together."
        actions={
          <ButtonLink href="/me/feedback/book">
            <CalendarPlus aria-hidden />
            Book a check-in
          </ButtonLink>
        }
      />
      <div className="space-y-6">
        <PrivacyLegend audience="employee" />

        <Card aria-labelledby="surveys">
          <CardHeader
            id="surveys"
            title="Pulse surveys"
            description="Five questions, about two minutes. Each survey is open for 14 days from its checkpoint."
            icon={<ClipboardList />}
            action={<ConfidentialBadge label="Answers are confidential" />}
          />
          <ul className="divide-y divide-line">
            {surveys.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{s.label} survey</p>
                  <p className="text-xs text-muted">
                    {s.state === "submitted" && s.response
                      ? `Submitted ${formatDate(s.response.submittedAt)}`
                      : s.state === "upcoming"
                        ? `Opens ${formatDate(s.opensOn)}`
                        : s.state === "open"
                          ? `Open until ${formatDate(s.closesOn)}`
                          : `Closed ${formatDate(s.closesOn)}`}
                  </p>
                </div>
                <Badge tone={SURVEY_TONE[s.state]}>{SURVEY_LABEL[s.state]}</Badge>
                {s.state === "open" ? (
                  <ButtonLink href={`/me/feedback/survey/${s.checkpoint}`} size="sm">
                    Take the {s.label} survey
                  </ButtonLink>
                ) : s.state === "submitted" ? (
                  <ButtonLink href={`/me/feedback/survey/${s.checkpoint}`} size="sm" variant="ghost">
                    View answers<span className="sr-only"> for the {s.label} survey</span>
                  </ButtonLink>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>

        <TopicsCard topics={topics} state={state} viewer={viewer} />

        <Card aria-labelledby="check-ins">
          <CardHeader
            id="check-ins"
            title="Your check-ins"
            description="Fictional slots with your HR partner, manager and buddy. No calendar invites are sent."
            icon={<CalendarDays />}
            action={<SharedBadge label="Agendas are shared" />}
          />
          {upcoming.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">
              No check-in booked.{" "}
              <Link href="/me/feedback/book" className="font-medium text-accent hover:underline">
                Book one
              </Link>{" "}
              whenever you would like to talk.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {upcoming.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                  <div className="min-w-0 flex-1">
                    <Link href={`/me/feedback/meetings/${m.id}`} className="text-sm font-medium text-ink hover:text-accent-strong hover:underline">
                      {meetingTitle(m)} with {m.hostName}
                    </Link>
                    <p className="text-xs text-muted">
                      {meetingWhen(m)} · {m.agenda.length} agenda points
                    </p>
                  </div>
                  <MeetingStatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
          {past.length > 0 ? (
            <details className="border-t border-line px-5 py-3">
              <summary className="cursor-pointer text-xs font-medium text-accent hover:text-accent-strong">
                Earlier check-ins ({past.length})
              </summary>
              <ul className="mt-2 divide-y divide-line">
                {past.map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-3 py-2.5">
                    <Link href={`/me/feedback/meetings/${m.id}`} className="min-w-0 flex-1 text-sm text-ink hover:underline">
                      {meetingTitle(m)} with {m.hostName} · {formatShortDate(m.date)}
                    </Link>
                    <MeetingStatusBadge status={m.status} />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Card>

        <Card aria-labelledby="action-plans">
          <CardHeader
            id="action-plans"
            title="Your action plan"
            description="Actions agreed in your check-ins. Tell us whether each one helped once it is done."
            icon={<ListTodo />}
            action={<SharedBadge />}
          />
          {actions.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted">No actions yet. Actions are agreed together in a check-in.</p>
          ) : (
            <div className="grid gap-3 p-4 lg:grid-cols-2">
              {actions.map((a) => {
                const meeting = a.source.kind === "meeting" ? state.meetings.find((m) => m.id === (a.source as { meetingId: string }).meetingId) : undefined;
                const topic = a.source.kind === "topic" ? state.topics.find((t) => t.id === (a.source as { topicId: string }).topicId) : undefined;
                return (
                  <ActionCard
                    key={a.id}
                    action={a}
                    onboarding={onboarding}
                    viewer={viewer}
                    today={today}
                    sourceLabel={meeting ? `${meetingTitle(meeting)}, ${formatShortDate(meeting.date)}` : topic ? `topic "${topicTitle(topic)}"` : undefined}
                  />
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function TopicsCard({ topics, state, viewer }: { topics: DiscussionTopic[]; state: FeedbackState; viewer: Viewer }) {
  const suggested = topics.filter((t) => t.status === "suggested");
  const reviewed = topics.filter((t) => t.status !== "suggested");
  return (
    <Card aria-labelledby="topics-heading" id="topics" className="scroll-mt-6">
      <CardHeader
        id="topics-heading"
        title="Discussion topics"
        description="Suggested when you rate an area 2 or below. You decide whether a topic is shared."
        icon={<Lightbulb />}
      />
      {topics.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No topics. They appear here only if a survey answer suggests one.</p>
      ) : null}
      {suggested.length > 0 ? (
        <div className="space-y-3 p-4">
          <p className="text-sm text-ink-soft">
            <strong className="font-semibold text-ink">Waiting for your review.</strong> These are private until you choose.
            Sharing adds the topic (not your rating or comment) to your next check-in agenda.
          </p>
          {suggested.map((t) => (
            <TopicReview key={t.id} topic={t} viewer={viewer} />
          ))}
        </div>
      ) : null}
      {reviewed.length > 0 ? (
        <ul className="divide-y divide-line border-t border-line">
          {reviewed.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{topicTitle(t)}</p>
                <p className="text-xs text-muted">
                  From your {surveyLabel(t.checkpoint)} survey{t.employeeNote ? ` · your note: "${t.employeeNote}"` : ""}
                </p>
              </div>
              {t.status === "private" ? (
                <>
                  <Badge tone="neutral" icon={<Lock aria-hidden />}>
                    Kept private
                  </Badge>
                  <Button size="sm" variant="ghost" onClick={() => feedbackActions.reviewTopic(viewer, t.id, "share")}>
                    Share after all<span className="sr-only">: {topicTitle(t)}</span>
                  </Button>
                </>
              ) : t.status === "shared" ? (
                <>
                  <SharedBadge />
                  {!isTopicInUse(state, t.id) ? (
                    <Button size="sm" variant="ghost" onClick={() => feedbackActions.reviewTopic(viewer, t.id, "keep-private")}>
                      Stop sharing<span className="sr-only">: {topicTitle(t)}</span>
                    </Button>
                  ) : (
                    <span className="text-xs text-muted">On an agenda</span>
                  )}
                </>
              ) : (
                <Badge tone="success">Discussed</Badge>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}

function TopicReview({ topic, viewer }: { topic: DiscussionTopic; viewer: Viewer }) {
  const [note, setNote] = useState("");
  const id = `note-${topic.id}`;
  return (
    <article aria-label={`Suggested topic: ${topicTitle(topic)}`} className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{topicTitle(topic)}</p>
        <Badge tone="warning">Suggested · private</Badge>
      </div>
      <p className="mt-1 text-xs text-muted">
        From your {surveyLabel(topic.checkpoint)} survey. HR and your manager do not see it unless you share it.
      </p>
      <label htmlFor={id} className="mt-3 block text-xs font-medium text-ink-soft">
        Add a few words to share with the topic (optional)
      </label>
      <input
        id={id}
        value={note}
        maxLength={TOPIC_NOTE_MAX_LENGTH}
        onChange={(e) => setNote(e.target.value)}
        className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => feedbackActions.reviewTopic(viewer, topic.id, "share", note)}>
          Share for discussion
          <ArrowRight aria-hidden />
        </Button>
        <Button size="sm" variant="secondary" onClick={() => feedbackActions.reviewTopic(viewer, topic.id, "keep-private")}>
          Keep private
        </Button>
      </div>
    </article>
  );
}
