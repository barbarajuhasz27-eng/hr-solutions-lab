"use client";

import { ArrowLeft, CheckCircle2, ClipboardList, Lightbulb } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ConfidentialBadge } from "@/components/feedback/feedback-ui";
import { PortalSkeleton } from "@/components/portal/portal-home-view";
import { usePortalCase } from "@/components/portal/use-portal-case";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { AREA_INFO, COMMENT_MAX_LENGTH, getSurveys, RATING_LABELS, type SurveyInfo } from "@/lib/feedback";
import { feedbackActions, useFeedback } from "@/lib/use-feedback";
import { FEEDBACK_AREAS, SURVEY_CHECKPOINTS, type FeedbackArea, type Rating, type SurveyCheckpoint } from "@/types/feedback";

const RATINGS: Rating[] = [1, 2, 3, 4, 5];

export function SurveyView({ checkpoint }: { checkpoint: string }) {
  const portal = usePortalCase();
  const feedback = useFeedback();
  const back = (
    <ButtonLink href="/me/feedback" variant="ghost" size="sm" className="-ml-2 mb-3">
      <ArrowLeft aria-hidden />
      Back to Feedback &amp; check-ins
    </ButtonLink>
  );

  if (portal.status === "loading" || !feedback.hydrated) return <PortalSkeleton />;
  const valid = (SURVEY_CHECKPOINTS as readonly string[]).includes(checkpoint);
  if (portal.status !== "ready" || !valid) {
    return (
      <>
        {back}
        <Card>
          <EmptyState icon={<ClipboardList />} title="Survey not found" description="Your surveys are listed under Feedback & check-ins." />
        </Card>
      </>
    );
  }
  const survey = getSurveys(portal.onboarding, feedback.state.responses, portal.today).find(
    (s) => s.checkpoint === (checkpoint as SurveyCheckpoint),
  )!;
  const newTopics = feedback.state.topics.filter((t) => t.responseId === survey.id && t.status === "suggested").length;

  return (
    <>
      {back}
      <SurveyContent
        key={survey.id}
        survey={survey}
        newTopics={newTopics}
        onSubmit={(ratings, comment) =>
          feedbackActions.submitSurvey(portal.viewer, portal.onboarding.id, survey.checkpoint, ratings, comment)
        }
      />
    </>
  );
}

function SurveyContent({
  survey,
  newTopics,
  onSubmit,
}: {
  survey: SurveyInfo;
  newTopics: number;
  onSubmit: (ratings: Partial<Record<FeedbackArea, number>>, comment: string) => string;
}) {
  const [ratings, setRatings] = useState<Partial<Record<FeedbackArea, Rating>>>({});
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const confirmationRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (justSubmitted) confirmationRef.current?.focus();
  }, [justSubmitted]);

  const header = (
    <div>
      <p className="text-xs font-semibold tracking-wider text-accent uppercase">Pulse survey</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{survey.label} check-in survey</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        <ConfidentialBadge />
        <span>Your answers are confidential. Nothing is shared unless you choose to share a topic.</span>
      </div>
    </div>
  );

  if (survey.state === "submitted" && survey.response) {
    return (
      <Card className="space-y-5 p-5 sm:p-7">
        {header}
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
          <h2 ref={confirmationRef} tabIndex={-1} className="flex items-center gap-2 font-semibold outline-none">
            <CheckCircle2 aria-hidden className="size-5 text-emerald-700" />
            {justSubmitted ? "Thank you, your survey is submitted" : `Submitted on ${formatDate(survey.response.submittedAt)}`}
          </h2>
          <p className="mt-1 text-sm">
            Each survey can be submitted once, so your answers are saved as they are.
            {justSubmitted && newTopics > 0
              ? ` ${newTopics === 1 ? "One topic was" : `${newTopics} topics were`} suggested for you to review. Nothing is shared until you decide.`
              : ""}
          </p>
          {newTopics > 0 ? (
            <ButtonLink href="/me/feedback#topics" size="sm" className="mt-3">
              <Lightbulb aria-hidden />
              Review suggested topics
            </ButtonLink>
          ) : null}
        </div>
        <section aria-labelledby="your-answers">
          <h2 id="your-answers" className="text-sm font-semibold text-ink">
            Your answers <span className="font-normal text-muted">(visible to you; HR can open them only on purpose)</span>
          </h2>
          <dl className="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
            {FEEDBACK_AREAS.map((area) => (
              <div key={area} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <dt className="text-ink-soft">{AREA_INFO[area].label}</dt>
                <dd className="font-medium text-ink tabular-nums">
                  {survey.response!.ratings[area]} · {RATING_LABELS[survey.response!.ratings[area]]}
                </dd>
              </div>
            ))}
            {survey.response.comment ? (
              <div className="px-3 py-2">
                <dt className="text-ink-soft">Your comment</dt>
                <dd className="mt-0.5 text-ink">{survey.response.comment}</dd>
              </div>
            ) : null}
          </dl>
        </section>
      </Card>
    );
  }

  if (survey.state !== "open") {
    return (
      <Card className="space-y-4 p-5 sm:p-7">
        {header}
        <p className="rounded-lg bg-subtle px-4 py-3 text-sm text-ink-soft">
          {survey.state === "upcoming"
            ? `This survey opens on ${formatDate(survey.opensOn)}.`
            : `This survey closed on ${formatDate(survey.closesOn)} without an answer. That is fine; the next one will open at its checkpoint.`}
        </p>
      </Card>
    );
  }

  const missing = FEEDBACK_AREAS.filter((a) => !ratings[a]);
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (missing.length > 0) {
      setError(`Please rate every statement (${missing.length} left).`);
      return;
    }
    const result = onSubmit(ratings, comment);
    if (result === "submitted") setJustSubmitted(true);
    else if (result === "already-submitted") setError("This survey has already been submitted.");
    else setError("The survey could not be submitted. It may have closed.");
  };

  return (
    <Card className="p-5 sm:p-7">
      {header}
      <p className="mt-3 text-sm text-muted">
        Open until {formatDate(survey.closesOn)}. Rate each statement from 1 (strongly disagree) to 5 (strongly agree).
        A rating of 2 or below suggests a discussion topic that only you can decide to share.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-5" noValidate>
        {FEEDBACK_AREAS.map((area, i) => (
          <fieldset key={area} className="rounded-xl border border-line p-4">
            <legend className="px-1 text-sm font-semibold text-ink">
              {i + 1}. {AREA_INFO[area].label}
            </legend>
            <p className="text-sm text-ink-soft">{AREA_INFO[area].question}</p>
            <div className="mt-3 grid grid-cols-5 gap-1.5 sm:gap-2">
              {RATINGS.map((value) => (
                <label
                  key={value}
                  className={cn(
                    "flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center transition-colors",
                    ratings[area] === value ? "border-accent bg-accent-soft" : "border-line-strong hover:bg-subtle",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                  )}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={area}
                    value={value}
                    checked={ratings[area] === value}
                    onChange={() => {
                      setRatings((prev) => ({ ...prev, [area]: value }));
                      setError(null);
                    }}
                    aria-label={`${AREA_INFO[area].label}: ${value}, ${RATING_LABELS[value]}`}
                  />
                  <span aria-hidden className="text-base font-semibold text-ink tabular-nums">
                    {value}
                  </span>
                  <span aria-hidden className="hidden text-[11px] leading-tight text-muted sm:block">
                    {RATING_LABELS[value]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div>
          <label htmlFor="survey-comment" className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
            Anything else you would like to tell us? <span className="font-normal text-muted">(optional)</span>
            <ConfidentialBadge />
          </label>
          <textarea
            id="survey-comment"
            value={comment}
            maxLength={COMMENT_MAX_LENGTH}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="mt-1.5 w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25"
          />
          <p className="mt-1 text-xs text-muted">
            Your comment is never copied into agendas or shared with your manager. Do not include other people&apos;s
            personal details.
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <div className="flex justify-end">
          <Button type="submit">Submit survey</Button>
        </div>
      </form>
    </Card>
  );
}
