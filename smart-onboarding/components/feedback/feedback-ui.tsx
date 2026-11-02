"use client";

import { CheckCircle2, Circle, CircleDashed, Clock3, EyeOff, Link2, RotateCcw, Users, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SelectInput, TextInput } from "@/components/ui/form-controls";
import { canSetActionStatus, canGiveFeedback, canManageCheckIns, type Viewer } from "@/lib/access";
import { cn } from "@/lib/cn";
import { addDays, formatDate, formatShortDate } from "@/lib/dates";
import {
  canReopen,
  canRespondToFollowUp,
  FOLLOW_UP_LABELS,
  isActionOverdue,
  MEETING_TYPE_INFO,
} from "@/lib/feedback";
import { feedbackActions } from "@/lib/use-feedback";
import {
  ACTION_STATUSES,
  FOLLOW_UP_RESPONSES,
  type ActionItem,
  type ActionStatus,
  type Meeting,
  type MeetingStatus,
} from "@/types/feedback";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

/* ------------------------------------------------------------------ */
/* Privacy labels                                                      */
/* ------------------------------------------------------------------ */

export function ConfidentialBadge({ label = "Confidential" }: { label?: string }) {
  return (
    <Badge tone="neutral" icon={<EyeOff aria-hidden />} className="bg-slate-800 text-white ring-slate-800">
      {label}
    </Badge>
  );
}

export function SharedBadge({ label = "Shared" }: { label?: string }) {
  return (
    <Badge tone="info" icon={<Users aria-hidden />}>
      {label}
    </Badge>
  );
}

/** Side-by-side explanation of what stays confidential and what is shared. */
export function PrivacyLegend({ audience }: { audience: "employee" | "hr" }) {
  const confidential =
    audience === "employee"
      ? ["Your survey ratings and comments", "Suggested topics until you choose to share them", "HR-only notes"]
      : ["Raw survey ratings and comments", "Suggested topics the employee has not shared", "HR-only meeting notes"];
  const shared =
    audience === "employee"
      ? ["Topics you choose to share", "Check-in agendas", "Agreed outcomes", "Action plans and your follow-up answers"]
      : ["Topics the employee chose to share", "Check-in agendas", "Agreed outcomes", "Action plans and follow-ups"];
  return (
    <section aria-label="What is confidential and what is shared" className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <ConfidentialBadge />
          <span className="text-sm font-semibold text-ink">
            {audience === "employee" ? "Stays with you (and HR, if needed)" : "Not shown in shared views"}
          </span>
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {confidential.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-4">
        <div className="flex items-center gap-2">
          <SharedBadge />
          <span className="text-sm font-semibold text-ink">Seen by the people in your check-ins</span>
        </div>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-soft">
          {shared.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted sm:col-span-2">
        A low rating only suggests a topic for you to review. It is never a performance warning or a risk rating, and it
        never creates an action by itself. Simulated prototype: there is no sign-in, so these rules are demonstrated, not
        enforced by real access control.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Status badges                                                       */
/* ------------------------------------------------------------------ */

const MEETING_TONE: Record<MeetingStatus, Tone> = { scheduled: "info", completed: "success", cancelled: "neutral" };
const MEETING_LABEL: Record<MeetingStatus, string> = { scheduled: "Scheduled", completed: "Completed", cancelled: "Cancelled" };

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return <Badge tone={MEETING_TONE[status]}>{MEETING_LABEL[status]}</Badge>;
}

export function meetingWhen(meeting: Pick<Meeting, "date" | "time" | "durationMinutes">): string {
  return `${formatDate(meeting.date)}, ${meeting.time} (${meeting.durationMinutes} min)`;
}

export function meetingParticipants(meeting: Meeting, employeeName: string): string {
  return `${employeeName} and ${meeting.hostName} (${MEETING_TYPE_INFO[meeting.type].hostRole})`;
}

const ACTION_TONE: Record<ActionStatus, Tone> = { Open: "neutral", "In progress": "info", Completed: "success" };
const ACTION_ICON: Record<ActionStatus, typeof Circle> = { Open: Circle, "In progress": CircleDashed, Completed: CheckCircle2 };

export function ActionStatusBadge({ action, today }: { action: ActionItem; today: ISODate }) {
  const Icon = ACTION_ICON[action.status];
  return (
    <span className="inline-flex flex-wrap gap-1">
      <Badge tone={ACTION_TONE[action.status]} icon={<Icon aria-hidden />}>
        {action.status}
      </Badge>
      {isActionOverdue(action, today) ? <Badge tone="danger">Overdue</Badge> : null}
      {action.reopenCount > 0 ? (
        <Badge tone="warning" icon={<RotateCcw aria-hidden />}>
          Reopened
        </Badge>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Action card                                                         */
/* ------------------------------------------------------------------ */

/**
 * One action plan item. Shared with the employee and HR. Status changes follow the access
 * rules; follow-up answers and reopening are offered to the employee once the action is done.
 */
export function ActionCard({
  action,
  onboarding,
  viewer,
  today,
  sourceLabel,
  showEmployee = false,
}: {
  action: ActionItem;
  onboarding?: OnboardingCase;
  viewer: Viewer;
  today: ISODate;
  sourceLabel?: string;
  showEmployee?: boolean;
}) {
  const [newDue, setNewDue] = useState(addDays(today, 14));
  const linked = action.linkedTaskId ? onboarding?.tasks.find((t) => t.id === action.linkedTaskId) : undefined;
  const isEmployee = canGiveFeedback(viewer, action.caseId);
  const lastFollowUp = action.followUps.at(-1);

  return (
    <article
      aria-label={`Action: ${action.description}`}
      className={cn(
        "rounded-xl border bg-surface p-4",
        isActionOverdue(action, today) ? "border-red-200" : "border-line",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {showEmployee && onboarding ? <p className="text-xs font-medium text-muted">{onboarding.employeeName}</p> : null}
          <p className="text-sm font-semibold text-ink">{action.description}</p>
          <p className="mt-0.5 text-xs text-muted">
            Owner: {action.owner} · due <time dateTime={action.dueDate}>{formatShortDate(action.dueDate)}</time>
            {sourceLabel ? <> · from {sourceLabel}</> : null}
          </p>
          {linked ? (
            <p className="mt-1 inline-flex items-center gap-1 text-xs text-ink-soft">
              <Link2 aria-hidden className="size-3" />
              Linked onboarding task: {linked.title}
            </p>
          ) : null}
        </div>
        <ActionStatusBadge action={action} today={today} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canSetActionStatus(viewer, action) ? (
          <label className="flex items-center gap-2 text-xs text-muted">
            Status
            <SelectInput
              size="sm"
              className="w-36"
              aria-label={`Status of ${action.description}`}
              value={action.status}
              onChange={(e) => feedbackActions.setActionStatus(viewer, action.id, e.target.value as ActionStatus)}
            >
              {ACTION_STATUSES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </SelectInput>
          </label>
        ) : null}
      </div>

      {isEmployee && canRespondToFollowUp(action) ? (
        <fieldset className="mt-3 rounded-lg bg-subtle p-3">
          <legend className="sr-only">Did this action help?</legend>
          <p className="text-sm font-medium text-ink" aria-hidden>
            Did this action help?
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FOLLOW_UP_RESPONSES.map((response) => (
              <Button
                key={response}
                size="sm"
                variant="secondary"
                onClick={() => feedbackActions.recordFollowUp(viewer, action.id, response)}
              >
                {FOLLOW_UP_LABELS[response]}
              </Button>
            ))}
          </div>
        </fieldset>
      ) : null}

      {lastFollowUp ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-ink-soft">
          {lastFollowUp.response === "not-helped" ? (
            <XCircle aria-hidden className="size-4 text-amber-700" />
          ) : (
            <CheckCircle2 aria-hidden className="size-4 text-emerald-700" />
          )}
          Follow-up: {FOLLOW_UP_LABELS[lastFollowUp.response]} ({formatShortDate(lastFollowUp.at)})
        </p>
      ) : null}

      {canReopen(action) && (isEmployee || canManageCheckIns(viewer)) ? (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <label className="text-xs text-ink-soft">
            New due date
            <TextInput
              type="date"
              className="mt-1 h-9 w-40"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
            />
          </label>
          <Button size="sm" onClick={() => feedbackActions.reopenAction(viewer, action.id, newDue)}>
            <RotateCcw aria-hidden />
            Reopen action
          </Button>
          <p className="w-full text-xs text-muted">The original history and follow-up answers are kept.</p>
        </div>
      ) : null}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-medium text-accent hover:text-accent-strong">
          History ({action.history.length})
        </summary>
        <ol className="mt-2 space-y-1 border-l border-line pl-3 text-xs text-muted">
          {action.history.map((event, i) => (
            <li key={i} className="flex gap-1.5">
              <Clock3 aria-hidden className="mt-0.5 size-3 shrink-0" />
              <span>
                <time dateTime={event.at}>{formatShortDate(event.at)}</time> · {event.detail} · {event.by}
              </span>
            </li>
          ))}
        </ol>
      </details>
    </article>
  );
}
