"use client";

import { EyeOff, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ActionCard, ConfidentialBadge, MeetingStatusBadge, meetingWhen, SharedBadge } from "@/components/feedback/feedback-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import type { Viewer } from "@/lib/access";
import { formatShortDate } from "@/lib/dates";
import { actionsForCase, AREA_INFO, getSurveys, meetingTitle, sharedTopics, sortMeetings } from "@/lib/feedback";
import { useFeedback } from "@/lib/use-feedback";
import { FEEDBACK_AREAS } from "@/types/feedback";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

const HR: Viewer = { role: "hr" };
const STATE_LABEL = { open: "Open", submitted: "Submitted", upcoming: "Upcoming", closed: "Closed" } as const;

/** Feedback and check-ins for one employee on the HR case page. */
export function CaseFeedbackSection({ onboarding, today }: { onboarding: OnboardingCase; today: ISODate }) {
  const feedback = useFeedback();
  const [showConfidential, setShowConfidential] = useState(false);
  if (!feedback.hydrated) return null;
  const state = feedback.state;
  const surveys = getSurveys(onboarding, state.responses, today);
  const topics = sharedTopics(state, onboarding.id);
  const meetings = sortMeetings(state.meetings.filter((m) => m.caseId === onboarding.id && m.status !== "cancelled"));
  const actions = actionsForCase(state, onboarding.id);
  const submitted = surveys.filter((s) => s.response);

  return (
    <Card aria-labelledby="case-feedback">
      <CardHeader
        id="case-feedback"
        title="Feedback & check-ins"
        description={`${submitted.length} of ${surveys.filter((s) => s.state !== "upcoming").length} opened surveys submitted`}
        icon={<MessagesSquare />}
      />
      <div className="space-y-5 px-5 py-4">
        <section aria-label="Survey status">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Surveys (status only)</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {surveys.map((s) => (
              <li key={s.id}>
                <Badge tone={s.state === "submitted" ? "success" : s.state === "open" ? "accent" : "neutral"}>
                  {s.label}: {STATE_LABEL[s.state]}
                </Badge>
              </li>
            ))}
          </ul>
        </section>

        {submitted.length > 0 ? (
          <section aria-label="Confidential survey answers" className="rounded-xl border border-slate-300 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ConfidentialBadge label="Confidential · HR only" />
                <span className="text-sm text-ink-soft">Raw ratings and comments are hidden by default.</span>
              </div>
              <Button size="sm" variant="secondary" aria-expanded={showConfidential} onClick={() => setShowConfidential((v) => !v)}>
                <EyeOff aria-hidden />
                {showConfidential ? "Hide confidential answers" : "Show confidential answers"}
              </Button>
            </div>
            {showConfidential ? (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-muted">
                  For HR support only. Do not copy into agendas, actions or manager conversations. A low rating is not a
                  performance warning or a risk rating.
                </p>
                {submitted.map((s) => (
                  <div key={s.id} className="rounded-lg border border-line bg-surface p-3">
                    <p className="text-sm font-medium text-ink">
                      {s.label} survey · submitted {formatShortDate(s.response!.submittedAt)}
                    </p>
                    <dl className="mt-2 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">
                      {FEEDBACK_AREAS.map((area) => (
                        <div key={area} className="flex justify-between gap-2">
                          <dt className="text-ink-soft">{AREA_INFO[area].label}</dt>
                          <dd className="font-medium tabular-nums">{s.response!.ratings[area]} / 5</dd>
                        </div>
                      ))}
                    </dl>
                    {s.response!.comment ? <p className="mt-2 text-sm text-ink-soft">Comment: {s.response!.comment}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        <section aria-label="Shared topics">
          <h3 className="flex items-center gap-2 text-xs font-semibold tracking-wider text-muted uppercase">
            Shared topics <SharedBadge />
          </h3>
          {topics.length === 0 ? (
            <p className="mt-1 text-sm text-muted">None shared.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {topics.map((t) => (
                <li key={t.id} className="text-ink">
                  {t.title}
                  {t.note ? <span className="text-muted"> · &ldquo;{t.note}&rdquo;</span> : null}
                  <span className="text-muted"> · {t.status === "shared" ? "awaiting discussion" : "discussed"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Check-ins">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Check-ins</h3>
          {meetings.length === 0 ? (
            <p className="mt-1 text-sm text-muted">None booked.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {meetings.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-2 py-2">
                  <Link href={`/check-ins/${m.id}`} className="min-w-0 flex-1 text-sm text-accent hover:underline">
                    {meetingTitle(m)} with {m.hostName} · {meetingWhen(m)}
                  </Link>
                  <MeetingStatusBadge status={m.status} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-label="Action plan">
          <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Action plan</h3>
          {actions.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No actions.</p>
          ) : (
            <div className="mt-2 grid gap-3 lg:grid-cols-2">
              {actions.map((a) => (
                <ActionCard key={a.id} action={a} onboarding={onboarding} viewer={HR} today={today} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Card>
  );
}
