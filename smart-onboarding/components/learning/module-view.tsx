"use client";

import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, Clock3, ListChecks, Lock, PartyPopper } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { DueLabel, LearningDisclaimer, LearningStatusBadge } from "@/components/learning/learning-ui";
import { QuizRunner } from "@/components/learning/quiz-runner";
import { PortalSkeleton } from "@/components/portal/portal-home-view";
import { usePortalCase } from "@/components/portal/use-portal-case";
import { RequirementBadge } from "@/components/tasks/task-dependencies";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress-bar";
import type { Viewer } from "@/lib/access";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/dates";
import { assignmentProgress, assignmentStatus, isQuizUnlocked } from "@/lib/learning";
import { findModule } from "@/lib/learning-catalog";
import { learningActions, useLearning } from "@/lib/use-learning";
import type { LearningAssignment, LearningModule } from "@/types/learning";
import type { ISODate } from "@/types/onboarding";

export function ModuleView({ moduleId }: { moduleId: string }) {
  const portal = usePortalCase();
  const learning = useLearning();
  const learningModule = findModule(moduleId);

  useEffect(() => {
    if (learningModule) document.title = `${learningModule.title} · Smart Onboarding`;
  }, [learningModule]);

  const back = (
    <ButtonLink href="/me/learning" variant="ghost" size="sm" className="-ml-2 mb-3">
      <ArrowLeft aria-hidden />
      Back to Learning Center
    </ButtonLink>
  );

  if (portal.status === "loading" || !learning.hydrated) return <PortalSkeleton />;
  const assignment =
    portal.status === "ready" && learningModule
      ? learning.assignments.find((a) => a.caseId === portal.onboarding.id && a.moduleId === learningModule.id)
      : undefined;

  if (portal.status !== "ready" || !learningModule || !assignment) {
    return (
      <>
        {back}
        <Card>
          <EmptyState
            icon={<BookOpen />}
            title={learningModule ? "This module is not in your learning path" : "Module not found"}
            description={
              learningModule
                ? "It is assigned to other roles. Your own modules are listed in the Learning Center."
                : "It may have been removed from the catalog."
            }
            action={<ButtonLink href="/me/learning">Go to Learning Center</ButtonLink>}
          />
        </Card>
      </>
    );
  }

  return (
    <>
      {back}
      <ModuleContent
        key={assignment.id}
        learningModule={learningModule}
        assignment={assignment}
        viewer={portal.viewer}
        today={portal.today}
      />
    </>
  );
}

/** Index of the step to open: first unread lesson, else the quiz if not passed, else lesson 1. */
function defaultStep(learningModule: LearningModule, assignment: LearningAssignment): number {
  const unread = learningModule.lessons.findIndex((l) => !assignment.viewedLessonIds.includes(l.id));
  if (unread >= 0) return unread;
  if (learningModule.quiz && !assignment.completedAt) return learningModule.lessons.length;
  return 0;
}

function ModuleContent({
  learningModule,
  assignment,
  viewer,
  today,
}: {
  learningModule: LearningModule;
  assignment: LearningAssignment;
  viewer: Viewer;
  today: ISODate;
}) {
  const [step, setStep] = useState(() => defaultStep(learningModule, assignment));
  const status = assignmentStatus(assignment, today);
  const progress = assignmentProgress(assignment, learningModule);
  const unlocked = isQuizUnlocked(assignment, learningModule);
  const quizStep = learningModule.lessons.length;
  const lesson = learningModule.lessons[step];

  const markRead = () => {
    if (!lesson) return;
    learningActions.viewLesson(viewer, assignment.id, lesson.id);
    if (step < learningModule.lessons.length - 1 || learningModule.quiz) setStep(step + 1);
  };

  return (
    <div className="space-y-6">
      <Card className="p-5 sm:p-6">
        <p className="text-xs font-semibold tracking-wider text-accent uppercase">Learning module</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{learningModule.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">{learningModule.summary}</p>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <LearningStatusBadge status={status} />
          <RequirementBadge mandatory={assignment.mandatory} />
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Clock3 aria-hidden className="size-3" />
            {learningModule.durationMinutes} min
          </span>
          <DueLabel assignment={assignment} today={today} />
        </div>
        <ProgressBar value={progress.percent} label={`${learningModule.title} progress`} className="mt-4" />
        <LearningDisclaimer className="mt-4" />
        {assignment.completedAt ? (
          <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-900">
            <PartyPopper aria-hidden className="size-4 shrink-0" />
            Module completed on {formatDate(assignment.completedAt)}.
          </p>
        ) : null}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <nav aria-label="Module steps" className="lg:sticky lg:top-6 lg:self-start">
          <ol className="space-y-1 rounded-xl border border-line bg-surface p-2 shadow-card">
            {learningModule.lessons.map((l, i) => {
              const viewed = assignment.viewedLessonIds.includes(l.id);
              return (
                <li key={l.id}>
                  <StepButton
                    active={step === i}
                    onClick={() => setStep(i)}
                    icon={viewed ? <Check className="size-3.5" /> : <span className="text-[11px] font-semibold">{i + 1}</span>}
                    done={viewed}
                    label={l.title}
                    meta={viewed ? "Read" : `Lesson ${i + 1}`}
                  />
                </li>
              );
            })}
            {learningModule.quiz ? (
              <li>
                <StepButton
                  active={step === quizStep}
                  onClick={() => setStep(quizStep)}
                  icon={progress.quizPassed ? <Check className="size-3.5" /> : unlocked ? <ListChecks className="size-3.5" /> : <Lock className="size-3.5" />}
                  done={progress.quizPassed}
                  label="Quiz"
                  meta={progress.quizPassed ? "Passed" : unlocked ? `Pass mark ${learningModule.quiz.passMark}%` : "Opens after the lessons"}
                />
              </li>
            ) : null}
          </ol>
        </nav>

        <Card className="p-5 sm:p-7">
          {lesson ? (
            <article aria-labelledby="lesson-title">
              <p className="text-xs font-semibold tracking-wider text-accent uppercase">
                Lesson {step + 1} of {learningModule.lessons.length}
              </p>
              <h2 id="lesson-title" className="mt-1 text-xl font-semibold text-ink">
                {lesson.title}
              </h2>
              <div className="mt-4 max-w-prose space-y-3 text-[15px] leading-relaxed text-ink-soft">
                {lesson.body.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              <div className="mt-5 max-w-prose rounded-xl bg-subtle p-4 ring-1 ring-line">
                <h3 className="text-xs font-semibold tracking-wider text-muted uppercase">Key points</h3>
                <ul className="mt-2 space-y-1.5 text-sm text-ink">
                  {lesson.keyPoints.map((k, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-accent" />
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
              <LessonFooter
                step={step}
                learningModule={learningModule}
                viewed={assignment.viewedLessonIds.includes(lesson.id)}
                onPrevious={() => setStep(step - 1)}
                onNext={() => setStep(step + 1)}
                onMarkRead={markRead}
              />
            </article>
          ) : learningModule.quiz ? (
            <QuizRunner quiz={learningModule.quiz} assignment={assignment} viewer={viewer} unlocked={unlocked} />
          ) : null}
        </Card>
      </div>
    </div>
  );
}

function StepButton({
  active,
  done,
  icon,
  label,
  meta,
  onClick,
}: {
  active: boolean;
  done: boolean;
  icon: ReactNode;
  label: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "step" : undefined}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
        active ? "bg-accent-soft" : "hover:bg-subtle",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          done ? "bg-emerald-600 text-white" : active ? "bg-accent text-white" : "bg-subtle text-muted ring-1 ring-line",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className={cn("block truncate text-sm font-medium", active ? "text-accent-strong" : "text-ink")}>{label}</span>
        <span className="block text-xs text-muted">{meta}</span>
      </span>
    </button>
  );
}

function LessonFooter({
  step,
  learningModule,
  viewed,
  onPrevious,
  onNext,
  onMarkRead,
}: {
  step: number;
  learningModule: LearningModule;
  viewed: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onMarkRead: () => void;
}) {
  const last = step === learningModule.lessons.length - 1;
  const nextLabel = last ? (learningModule.quiz ? "Go to the quiz" : null) : "Next lesson";
  return (
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <div>
        {step > 0 ? (
          <Button variant="ghost" size="sm" onClick={onPrevious}>
            <ArrowLeft aria-hidden />
            Previous lesson
          </Button>
        ) : null}
      </div>
      {viewed ? (
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
            <CheckCircle2 aria-hidden className="size-4" />
            Read
          </span>
          {nextLabel ? (
            <Button variant="secondary" onClick={onNext}>
              {nextLabel}
              <ArrowRight aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : (
        <Button onClick={onMarkRead}>
          {last && !learningModule.quiz ? "Mark as read and finish" : "Mark as read and continue"}
          <ArrowRight aria-hidden />
        </Button>
      )}
    </div>
  );
}
