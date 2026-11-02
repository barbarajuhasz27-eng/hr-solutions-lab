"use client";

import { ArrowRight, CalendarCheck2, Flag, ListTodo, PartyPopper, UserX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { PortalFeedbackCard } from "@/components/feedback/portal-feedback-card";
import { PortalLearningCard } from "@/components/learning/portal-learning-card";
import { EmployeeTaskItem } from "@/components/portal/employee-task-item";
import { JourneyStrip } from "@/components/portal/journey-strip";
import { ContactsCard, PrivacyCard, ScheduleCard } from "@/components/portal/portal-cards";
import { usePortalCase } from "@/components/portal/use-portal-case";
import { useFeedback } from "@/lib/use-feedback";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { ProgressRing } from "@/components/ui/progress-ring";
import type { Viewer } from "@/lib/access";
import { formatDate, formatLongDate, formatShortDate } from "@/lib/dates";
import {
  firstName,
  getContacts,
  getJourneyPhases,
  getJourneyPosition,
  getNextCheckpoint,
  getPortalProgress,
  getSchedule,
  getWeekPlan,
  type EmployeeTask,
  type WeekPlan,
} from "@/lib/portal";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

export function PortalHomeView() {
  const state = usePortalCase();
  const feedback = useFeedback();
  if (state.status === "loading") return <PortalSkeleton />;
  if (state.status === "empty") {
    return (
      <Card>
        <EmptyState
          icon={<UserX />}
          title="No onboarding to preview"
          description="There are no onboarding cases in this browser. Reset the demo data, or switch to the HR preview to create one."
        />
      </Card>
    );
  }
  const { onboarding, today, viewer } = state;
  return (
    <div className="space-y-6">
      <WelcomeHero onboarding={onboarding} today={today} />
      <JourneyStrip phases={getJourneyPhases(onboarding, today)} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <ThisWeek plan={getWeekPlan(onboarding, today)} onboarding={onboarding} viewer={viewer} />
          <PortalFeedbackCard onboarding={onboarding} today={today} />
          <PortalLearningCard caseId={onboarding.id} today={today} />
        </div>
        <div className="space-y-6">
          <ContactsCard contacts={getContacts(onboarding)} />
          <ScheduleCard schedule={getSchedule(onboarding, today, feedback.hydrated ? feedback.state.meetings : [])} today={today} />
          <PrivacyCard />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function WelcomeHero({ onboarding, today }: { onboarding: OnboardingCase; today: ISODate }) {
  const name = firstName(onboarding.employeeName);
  const position = getJourneyPosition(onboarding, today);
  const checkpoint = getNextCheckpoint(onboarding, today);
  const progress = getPortalProgress(onboarding);

  let greeting: string;
  let context: ReactNode;
  switch (position.kind) {
    case "before-start":
      greeting = `Welcome aboard, ${name}`;
      context = (
        <>
          You start on <time dateTime={onboarding.startDate}>{formatLongDate(onboarding.startDate)}</time>.{" "}
          {position.daysUntilStart === 1 ? "Just one day to go." : `${position.daysUntilStart} days to go.`}
        </>
      );
      break;
    case "first-day":
      greeting = `Welcome to your first day, ${name}`;
      context = "We are glad you are here. Here is what today and the coming days look like.";
      break;
    case "in-progress":
      greeting = `Good to see you, ${name}`;
      context = `You are in week ${position.week} of your first 90 days.`;
      break;
    case "beyond-90":
      greeting = `Congratulations, ${name}`;
      context = "You have passed your first 90 days. Your onboarding journey is complete.";
      break;
  }

  return (
    <section
      aria-labelledby="portal-welcome"
      className="relative overflow-hidden rounded-2xl bg-ink px-5 py-6 text-white shadow-raised sm:px-8 sm:py-8"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-16 size-72 rounded-full bg-accent/40 blur-3xl"
      />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wider text-accent-ring uppercase">Your onboarding</p>
          <h1 id="portal-welcome" className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/80 sm:text-base">{context}</p>
          <p className="mt-3 text-sm text-white/65">
            {onboarding.jobTitle} · {onboarding.department} · {onboarding.location}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-5 rounded-xl bg-white/[0.07] p-4 ring-1 ring-white/10">
          <ProgressRing value={progress.overallPercent} label="Onboarding steps done" />
          <div className="space-y-2 text-sm">
            <p>
              <span className="font-semibold">
                {progress.done} of {progress.total}
              </span>{" "}
              <span className="text-white/75">steps done</span>
            </p>
            {progress.ownTotal > 0 ? (
              <p className="text-white/75">
                {progress.ownDone} of {progress.ownTotal} of yours
              </p>
            ) : null}
            {checkpoint ? (
              <p className="flex items-center gap-1.5 text-white/90">
                <Flag aria-hidden className="size-3.5 text-accent-ring" />
                <span>
                  Next: <strong className="font-semibold">{checkpoint.label}</strong>{" "}
                  <span className="text-white/70">
                    {checkpoint.daysAway === 0 ? "today" : `in ${checkpoint.daysAway} days`} ·{" "}
                    <time dateTime={checkpoint.date}>{formatShortDate(checkpoint.date)}</time>
                  </span>
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function TaskGroup({
  title,
  hint,
  tasks,
  onboarding,
  viewer,
  limit,
}: {
  title: string;
  hint?: string;
  tasks: EmployeeTask[];
  onboarding: OnboardingCase;
  viewer: Viewer;
  /** Show at most this many; the rest are reachable on the journey page. */
  limit?: number;
}) {
  const id = `week-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  const shown = limit ? tasks.slice(0, limit) : tasks;
  const hidden = tasks.length - shown.length;
  return (
    <section aria-labelledby={id} className="px-5 py-4">
      <h3 id={id} className="text-xs font-semibold tracking-wider text-muted uppercase">
        {title}
      </h3>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
      <ul className="divide-y divide-line">
        {shown.map((task) => (
          <EmployeeTaskItem key={task.id} task={task} caseId={onboarding.id} viewer={viewer} />
        ))}
      </ul>
      {hidden > 0 ? (
        <Link href="/me/journey" className="mt-1 inline-block text-sm font-medium text-accent hover:underline">
          and {hidden} more in your journey
        </Link>
      ) : null}
    </section>
  );
}

function ThisWeek({ plan, onboarding, viewer }: { plan: WeekPlan; onboarding: OnboardingCase; viewer: Viewer }) {
  const nothingDue = plan.yourTasks.length === 0 && plan.teamTasks.length === 0;
  return (
    <Card aria-labelledby="portal-week">
      <CardHeader
        id="portal-week"
        title="This week"
        description={`${formatDate(plan.from)} – ${formatDate(plan.to)}`}
        icon={<ListTodo />}
        action={
          <ButtonLink href="/me/journey" variant="ghost" size="sm">
            Full journey
            <ArrowRight aria-hidden />
          </ButtonLink>
        }
      />
      <div className="divide-y divide-line">
        {plan.yourTasks.length > 0 ? (
          <TaskGroup title="For you" tasks={plan.yourTasks} onboarding={onboarding} viewer={viewer} />
        ) : (
          <div className="flex items-start gap-3 px-5 py-4">
            <PartyPopper aria-hidden className="mt-0.5 size-5 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-semibold text-ink">Nothing for you to do this week</p>
              <p className="text-sm text-muted">
                You are all caught up. Your steps appear here when they are coming up.
              </p>
            </div>
          </div>
        )}
        {plan.teamTasks.length > 0 ? (
          <TaskGroup
            title="Your team is working on"
            hint="Handled by the people supporting your onboarding. Shown so you know what to expect."
            tasks={plan.teamTasks}
            limit={5}
            onboarding={onboarding}
            viewer={viewer}
          />
        ) : null}
        {nothingDue && plan.comingUp.length > 0 ? (
          <TaskGroup title="Coming up next" tasks={plan.comingUp} onboarding={onboarding} viewer={viewer} />
        ) : null}
        {plan.recentlyDone.length > 0 ? (
          <TaskGroup title="Done in the last 7 days" tasks={plan.recentlyDone} onboarding={onboarding} viewer={viewer} limit={3} />
        ) : null}
      </div>
      <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-xs text-muted">
        <CalendarCheck2 aria-hidden className="size-3.5" />
        <span>
          You can mark your own steps as done. Steps owned by others update as they complete them.{" "}
          <Link href="/me/journey" className="font-medium text-accent hover:underline">
            See every step
          </Link>
        </span>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

export function PortalSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading your onboarding">
      <Skeleton className="h-44 rounded-2xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
