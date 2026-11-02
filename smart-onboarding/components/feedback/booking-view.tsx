"use client";

import { ArrowLeft, CalendarCheck2, CalendarPlus, UserX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { meetingWhen, SharedBadge } from "@/components/feedback/feedback-ui";
import { PortalSkeleton } from "@/components/portal/portal-home-view";
import { usePortalCase } from "@/components/portal/use-portal-case";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import type { Viewer } from "@/lib/access";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import {
  availableSlots,
  buildDraftAgenda,
  hostFor,
  MAX_EMPLOYEE_POINTS,
  MEETING_TYPE_INFO,
  meetingTitle,
  upcomingMeetingOfType,
  type Slot,
} from "@/lib/feedback";
import { feedbackActions, useFeedback } from "@/lib/use-feedback";
import { MEETING_TYPES, type FeedbackState, type Meeting, type MeetingType } from "@/types/feedback";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

const SOURCE_LABEL = {
  "meeting-type": "Check-in",
  milestone: "Milestone",
  topic: "Your shared topic",
  employee: "Your point",
  participant: "Added by a participant",
} as const;

export function BookingView() {
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
  return <Booking onboarding={portal.onboarding} viewer={portal.viewer} today={portal.today} state={feedback.state} />;
}

function Booking({
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
  const [type, setType] = useState<MeetingType>("hr");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [points, setPoints] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Meeting | null>(null);

  const slots = useMemo(() => availableSlots(onboarding, type, state.meetings, today), [onboarding, type, state.meetings, today]);
  const existing = upcomingMeetingOfType(state.meetings, onboarding.id, type);
  const slot = slots.find((s) => s.id === slotId) ?? null;
  const pointList = points.split("\n").map((p) => p.trim()).filter(Boolean);
  const preview = slot
    ? buildDraftAgenda({ onboarding, type, date: slot.date, topics: state.topics, employeePoints: pointList, idPrefix: "preview" })
    : [];

  const byDate = new Map<string, Slot[]>();
  for (const s of slots) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);

  const back = (
    <ButtonLink href="/me/feedback" variant="ghost" size="sm" className="-ml-2 mb-3">
      <ArrowLeft aria-hidden />
      Back to Feedback &amp; check-ins
    </ButtonLink>
  );

  if (booked) {
    return (
      <>
        {back}
        <Card className="p-5 sm:p-7">
          <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <CalendarCheck2 aria-hidden className="size-5 text-emerald-700" />
              Check-in booked
            </h1>
            <p className="mt-1 text-sm">
              {meetingTitle(booked)} with {booked.hostName} on {meetingWhen(booked)}. The slot is now reserved for you and
              appears in your schedule.
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <ButtonLink href={`/me/feedback/meetings/${booked.id}`}>View the agenda</ButtonLink>
            <ButtonLink href="/me/feedback" variant="secondary">
              Back to Feedback &amp; check-ins
            </ButtonLink>
          </div>
        </Card>
      </>
    );
  }

  const confirm = () => {
    if (!slot) return;
    const { result, meeting } = feedbackActions.bookMeeting(viewer, onboarding.id, type, slot.id, pointList);
    if (result === "booked" && meeting) {
      setBooked(meeting);
      return;
    }
    setSlotId(null);
    setError(
      result === "slot-taken" || result === "invalid-slot"
        ? "That slot was just taken. Please choose another time."
        : result === "already-booked"
          ? "You already have this type of check-in booked."
          : "The check-in could not be booked.",
    );
  };

  return (
    <>
      {back}
      <PageHeader
        title="Book a check-in"
        description="Pick who you would like to talk to and a free slot. Times are fictional; no calendar invite is sent."
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <fieldset>
            <legend className="mb-2 text-sm font-semibold text-ink">1. Who would you like to meet?</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              {MEETING_TYPES.map((t) => (
                <label
                  key={t}
                  className={cn(
                    "cursor-pointer rounded-xl border bg-surface p-4 transition-colors",
                    type === t ? "border-accent ring-2 ring-accent/20" : "border-line hover:border-accent-ring",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  )}
                >
                  <input
                    type="radio"
                    name="meeting-type"
                    className="sr-only"
                    checked={type === t}
                    onChange={() => {
                      setType(t);
                      setSlotId(null);
                      setError(null);
                    }}
                  />
                  <span className="block text-sm font-semibold text-ink">{MEETING_TYPE_INFO[t].label}</span>
                  <span className="block text-sm text-ink-soft">
                    with {hostFor(onboarding, t)}, {MEETING_TYPE_INFO[t].hostRole.toLowerCase()}
                  </span>
                  <span className="mt-1 block text-xs text-muted">{MEETING_TYPE_INFO[t].description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <section aria-labelledby="slots-heading">
            <h2 id="slots-heading" className="mb-2 text-sm font-semibold text-ink">
              2. Choose a time
            </h2>
            {existing ? (
              <p className="rounded-xl border border-line bg-subtle px-4 py-3 text-sm text-ink-soft">
                You already have a {meetingTitle(existing).toLowerCase()} on {meetingWhen(existing)}.{" "}
                <Link href={`/me/feedback/meetings/${existing.id}`} className="font-medium text-accent hover:underline">
                  View or cancel it
                </Link>{" "}
                to book another.
              </p>
            ) : slots.length === 0 ? (
              <p className="rounded-xl border border-line bg-subtle px-4 py-3 text-sm text-ink-soft">
                No free slots in the next two weeks.
              </p>
            ) : (
              <div className="space-y-3">
                {[...byDate.entries()].map(([date, daySlots]) => (
                  <div key={date} className="flex flex-wrap items-center gap-2">
                    <span className="w-44 text-sm text-ink-soft">{formatDate(date)}</span>
                    {daySlots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={slotId === s.id}
                        aria-label={`${formatDate(s.date)} at ${s.time}`}
                        onClick={() => {
                          setSlotId(s.id);
                          setError(null);
                        }}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm font-medium tabular-nums transition-colors",
                          slotId === s.id ? "border-accent bg-accent text-white" : "border-line-strong bg-surface text-ink hover:bg-subtle",
                        )}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            {error ? (
              <p role="alert" className="mt-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}
          </section>

          <div>
            <label htmlFor="booking-points" className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink">
              3. Anything you would like to discuss? <span className="font-normal text-muted">(optional, one per line)</span>
              <SharedBadge label="Added to the shared agenda" />
            </label>
            <textarea
              id="booking-points"
              rows={3}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
            />
            <p className="mt-1 text-xs text-muted">Up to {MAX_EMPLOYEE_POINTS} points. Your survey answers are never added.</p>
          </div>
        </div>

        <aside aria-labelledby="draft-agenda" className="lg:sticky lg:top-6 lg:self-start">
          <Card className="p-5">
            <h2 id="draft-agenda" className="text-sm font-semibold text-ink">
              Draft agenda
            </h2>
            {slot ? (
              <>
                <p className="mt-1 text-xs text-muted">
                  {MEETING_TYPE_INFO[type].label} with {slot.hostName} · {formatDate(slot.date)}, {slot.time}
                </p>
                <ol className="mt-3 space-y-2 text-sm">
                  {preview.map((item) => (
                    <li key={item.id} className="rounded-lg bg-subtle px-3 py-2">
                      <span className="block text-ink">{item.text}</span>
                      <span className="text-xs text-muted">{SOURCE_LABEL[item.source]}</span>
                    </li>
                  ))}
                </ol>
                <Button className="mt-4 w-full" onClick={confirm}>
                  <CalendarPlus aria-hidden />
                  Book this slot
                </Button>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted">Choose a time to see the draft agenda.</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
