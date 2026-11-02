"use client";

import { ArrowRight, MessagesSquare } from "lucide-react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { canRespondToFollowUp, getSurveys, meetingTitle, sortMeetings } from "@/lib/feedback";
import { formatShortDate } from "@/lib/dates";
import { useFeedback } from "@/lib/use-feedback";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

/** "Feedback & check-ins" on the portal home: open surveys, topics to review, next check-in. */
export function PortalFeedbackCard({ onboarding, today }: { onboarding: OnboardingCase; today: ISODate }) {
  const feedback = useFeedback();
  if (!feedback.hydrated) return null;
  const state = feedback.state;
  const open = getSurveys(onboarding, state.responses, today).filter((s) => s.state === "open");
  const toReview = state.topics.filter((t) => t.caseId === onboarding.id && t.status === "suggested").length;
  const next = sortMeetings(state.meetings.filter((m) => m.caseId === onboarding.id && m.status === "scheduled"))[0];
  const followUps = state.actions.filter((a) => a.caseId === onboarding.id && canRespondToFollowUp(a)).length;

  const items = [
    ...open.map((s) => ({ key: s.id, href: `/me/feedback/survey/${s.checkpoint}`, text: `Your ${s.label} survey is open until ${formatShortDate(s.closesOn)}` })),
    ...(toReview > 0 ? [{ key: "topics", href: "/me/feedback#topics", text: `${toReview} suggested ${toReview === 1 ? "topic" : "topics"} to review (private until you decide)` }] : []),
    ...(next ? [{ key: next.id, href: `/me/feedback/meetings/${next.id}`, text: `${meetingTitle(next)} with ${next.hostName} on ${formatShortDate(next.date)} at ${next.time}` }] : []),
    ...(followUps > 0 ? [{ key: "follow-ups", href: "/me/feedback#action-plans", text: `${followUps} completed ${followUps === 1 ? "action" : "actions"}: did it help?` }] : []),
  ];

  return (
    <Card aria-labelledby="portal-feedback">
      <CardHeader
        id="portal-feedback"
        title="Feedback & check-ins"
        description="Pulse surveys, check-ins and your action plan"
        icon={<MessagesSquare />}
        action={
          <ButtonLink href="/me/feedback" variant="ghost" size="sm">
            Open
            <ArrowRight aria-hidden />
          </ButtonLink>
        }
      />
      {items.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">
          Nothing needs your attention.{" "}
          <Link href="/me/feedback/book" className="font-medium text-accent hover:underline">
            Book a check-in
          </Link>{" "}
          whenever you would like to talk.
        </p>
      ) : (
        <ul className="divide-y divide-line px-5 py-1">
          {items.map((item) => (
            <li key={item.key} className="py-3">
              <Link href={item.href} className="text-sm font-medium text-ink hover:text-accent-strong hover:underline">
                {item.text}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
