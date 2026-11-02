"use client";

import { ArrowLeft, CalendarDays, CheckCircle2, EyeOff, ListTodo, MessageSquarePlus, XCircle } from "lucide-react";
import { useState } from "react";
import { CreateActionForm } from "@/components/feedback/create-action-form";
import {
  ActionCard,
  ConfidentialBadge,
  MeetingStatusBadge,
  meetingParticipants,
  meetingWhen,
  SharedBadge,
} from "@/components/feedback/feedback-ui";
import { usePortalCase } from "@/components/portal/use-portal-case";
import { PortalSkeleton } from "@/components/portal/portal-home-view";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/misc";
import { canAddAgendaPoint, canCancelMeeting, canManageCheckIns, type Viewer } from "@/lib/access";
import { diffInDays, formatDate } from "@/lib/dates";
import { AGENDA_POINT_MAX_LENGTH, meetingTitle, OUTCOME_MAX_LENGTH } from "@/lib/feedback";
import { feedbackActions, useFeedback } from "@/lib/use-feedback";
import { useOnboarding } from "@/lib/use-onboarding";
import type { AgendaSource, FeedbackState, Meeting } from "@/types/feedback";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

const SOURCE_LABEL: Record<AgendaSource, string> = {
  "meeting-type": "Check-in",
  milestone: "Milestone",
  topic: "Topic shared by the employee",
  employee: "Added by the employee",
  participant: "Added by a participant",
};

const textarea =
  "mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25";

/** Meeting page in the New Hire preview. Only the previewed employee's own meetings open. */
export function PortalMeetingView({ meetingId }: { meetingId: string }) {
  const portal = usePortalCase();
  const feedback = useFeedback();
  if (portal.status === "loading" || !feedback.hydrated) return <PortalSkeleton />;
  const meeting =
    portal.status === "ready"
      ? feedback.state.meetings.find((m) => m.id === meetingId && m.caseId === portal.onboarding.id)
      : undefined;
  return (
    <>
      <ButtonLink href="/me/feedback" variant="ghost" size="sm" className="-ml-2 mb-3">
        <ArrowLeft aria-hidden />
        Back to Feedback &amp; check-ins
      </ButtonLink>
      {portal.status === "ready" && meeting ? (
        <MeetingRecord meeting={meeting} onboarding={portal.onboarding} viewer={portal.viewer} today={portal.today} state={feedback.state} />
      ) : (
        <Card>
          <EmptyState icon={<CalendarDays />} title="Check-in not found" description="Your check-ins are listed under Feedback & check-ins." />
        </Card>
      )}
    </>
  );
}

/** Meeting record in the HR workspace. */
export function HrMeetingView({ meetingId }: { meetingId: string }) {
  const data = useOnboarding();
  const feedback = useFeedback();
  const back = (
    <ButtonLink href="/check-ins" variant="ghost" size="sm" className="-ml-2 mb-3">
      <ArrowLeft aria-hidden />
      Back to check-ins
    </ButtonLink>
  );
  if (!data.hydrated || !feedback.hydrated) return <Skeleton className="h-96 rounded-xl" />;
  const meeting = feedback.state.meetings.find((m) => m.id === meetingId);
  const onboarding = meeting ? data.cases.find((c) => c.id === meeting.caseId) : undefined;
  return (
    <>
      {back}
      {meeting && onboarding ? (
        <MeetingRecord meeting={meeting} onboarding={onboarding} viewer={{ role: "hr" }} today={data.today} state={feedback.state} />
      ) : (
        <Card>
          <EmptyState icon={<CalendarDays />} title="Meeting record not found" description="It may belong to a deleted onboarding case." />
        </Card>
      )}
    </>
  );
}

export function MeetingRecord({
  meeting,
  onboarding,
  viewer,
  today,
  state,
}: {
  meeting: Meeting;
  onboarding: OnboardingCase;
  viewer: Viewer;
  today: ISODate;
  state: FeedbackState;
}) {
  const isHr = canManageCheckIns(viewer);
  const actions = state.actions.filter((a) => a.source.kind === "meeting" && a.source.meetingId === meeting.id);
  const canComplete = isHr && meeting.status === "scheduled" && diffInDays(meeting.date, today) >= 0;

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <p className="text-xs font-semibold tracking-wider text-accent uppercase">Check-in</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          {meetingTitle(meeting)} with {meeting.hostName}
        </h1>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">When</dt>
            <dd className="font-medium text-ink">{meetingWhen(meeting)}</dd>
          </div>
          <div>
            <dt className="text-muted">Participants</dt>
            <dd className="font-medium text-ink">{meetingParticipants(meeting, onboarding.employeeName)}</dd>
          </div>
          <div>
            <dt className="text-muted">Status</dt>
            <dd className="mt-0.5">
              <MeetingStatusBadge status={meeting.status} />
            </dd>
          </div>
        </dl>
        {meeting.status === "scheduled" && canCancelMeeting(viewer, meeting.caseId) ? (
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => feedbackActions.cancelMeeting(viewer, meeting.id)}>
            <XCircle aria-hidden />
            Cancel check-in
          </Button>
        ) : null}
        {meeting.status === "cancelled" && meeting.cancelledAt ? (
          <p className="mt-3 text-sm text-muted">Cancelled on {formatDate(meeting.cancelledAt)}. The slot was released.</p>
        ) : null}
      </Card>

      <Card aria-labelledby="agenda">
        <CardHeader
          id="agenda"
          title="Agenda"
          description="Prepared from the check-in type, the next milestone, topics the employee shared and points added by participants."
          icon={<ListTodo />}
          action={<SharedBadge />}
        />
        <ol className="divide-y divide-line">
          {meeting.agenda.map((item, i) => (
            <li key={item.id} className="flex gap-3 px-5 py-3">
              <span className="w-5 shrink-0 text-sm font-semibold text-muted tabular-nums">{i + 1}.</span>
              <div className="min-w-0">
                <p className="text-sm text-ink">{item.text}</p>
                <p className="text-xs text-muted">
                  {SOURCE_LABEL[item.source]}
                  {item.source === "participant" ? ` (${item.addedBy})` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
        {meeting.status === "scheduled" && canAddAgendaPoint(viewer, meeting.caseId) ? (
          <AgendaPointForm meeting={meeting} viewer={viewer} />
        ) : null}
        <p className="border-t border-line px-5 py-3 text-xs text-muted">
          Survey ratings and comments are never added to an agenda.
        </p>
      </Card>

      {meeting.status === "completed" ? (
        <Card aria-labelledby="outcome">
          <CardHeader id="outcome" title="Agreed outcome" icon={<CheckCircle2 />} action={<SharedBadge />} />
          <p className="px-5 py-4 text-sm text-ink">{meeting.outcome}</p>
          {meeting.completedAt ? (
            <p className="border-t border-line px-5 py-3 text-xs text-muted">Recorded on {formatDate(meeting.completedAt)}.</p>
          ) : null}
        </Card>
      ) : null}

      {isHr && meeting.hrNote ? (
        <Card aria-labelledby="hr-note" className="border-slate-300">
          <CardHeader id="hr-note" title="HR-only note" icon={<EyeOff />} action={<ConfidentialBadge label="HR only" />} />
          <p className="px-5 py-4 text-sm text-ink">{meeting.hrNote}</p>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">Not shown to the employee, the manager or in shared agendas.</p>
        </Card>
      ) : null}

      {canComplete ? <CompleteForm meeting={meeting} viewer={viewer} /> : null}
      {isHr && meeting.status === "scheduled" && !canComplete ? (
        <p className="text-sm text-muted">The outcome can be recorded on or after {formatDate(meeting.date)}.</p>
      ) : null}

      {meeting.status === "completed" ? (
        <Card aria-labelledby="meeting-actions">
          <CardHeader
            id="meeting-actions"
            title="Agreed actions"
            description="Created from this check-in's agreed outcome"
            icon={<ListTodo />}
            action={<SharedBadge />}
          />
          <div className="space-y-3 p-4">
            {actions.length === 0 ? <p className="text-sm text-muted">No actions agreed in this check-in.</p> : null}
            {actions.map((a) => (
              <ActionCard key={a.id} action={a} onboarding={onboarding} viewer={viewer} today={today} />
            ))}
            {isHr ? (
              <CreateActionForm
                onboarding={onboarding}
                source={{ kind: "meeting", meetingId: meeting.id }}
                viewer={viewer}
                today={today}
                idPrefix={`action-${meeting.id}`}
              />
            ) : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function AgendaPointForm({ meeting, viewer }: { meeting: Meeting; viewer: Viewer }) {
  const [text, setText] = useState("");
  const id = `agenda-point-${meeting.id}`;
  return (
    <form
      className="flex flex-wrap items-end gap-2 border-t border-line px-5 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return;
        feedbackActions.addAgendaPoint(viewer, meeting.id, text);
        setText("");
      }}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="block text-xs font-medium text-ink-soft">
          Add a shared agenda point
        </label>
        <input
          id={id}
          value={text}
          maxLength={AGENDA_POINT_MAX_LENGTH}
          onChange={(e) => setText(e.target.value)}
          className="mt-1 h-9 w-full rounded-lg border border-line-strong bg-surface px-3 text-sm focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
        />
      </div>
      <Button type="submit" size="sm" variant="secondary" disabled={!text.trim()}>
        <MessageSquarePlus aria-hidden />
        Add point
      </Button>
    </form>
  );
}

function CompleteForm({ meeting, viewer }: { meeting: Meeting; viewer: Viewer }) {
  const [outcome, setOutcome] = useState("");
  const [hrNote, setHrNote] = useState("");
  return (
    <Card aria-labelledby="record-outcome">
      <CardHeader
        id="record-outcome"
        title="Record the outcome"
        description="Write what was agreed together. The outcome is shared with the employee."
        icon={<CheckCircle2 />}
      />
      <form
        className="space-y-4 px-5 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          feedbackActions.completeMeeting(viewer, meeting.id, outcome, hrNote);
        }}
      >
        <div>
          <label htmlFor="outcome-text" className="flex items-center gap-2 text-sm font-medium text-ink">
            Agreed outcome <SharedBadge />
          </label>
          <textarea id="outcome-text" rows={3} maxLength={OUTCOME_MAX_LENGTH} value={outcome} onChange={(e) => setOutcome(e.target.value)} className={textarea} />
        </div>
        <div>
          <label htmlFor="hr-note-text" className="flex items-center gap-2 text-sm font-medium text-ink">
            HR-only note (optional) <ConfidentialBadge label="HR only" />
          </label>
          <textarea id="hr-note-text" rows={2} maxLength={OUTCOME_MAX_LENGTH} value={hrNote} onChange={(e) => setHrNote(e.target.value)} className={textarea} />
          <p className="mt-1 text-xs text-muted">Kept separate from the shared record. Never shown to the employee or the manager.</p>
        </div>
        <Button type="submit" disabled={!outcome.trim()}>
          Mark as completed
        </Button>
      </form>
    </Card>
  );
}
