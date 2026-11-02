"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  CalendarDays,
  Eye,
  Flag,
  HeartHandshake,
  Layers,
  MapPin,
  Trash2,
  UserRound,
  UsersRound,
  UserX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CaseFeedbackSection } from "@/components/feedback/case-feedback-section";
import { CaseLearningSection } from "@/components/learning/case-learning-section";
import { MilestoneStatusBadge } from "@/components/onboarding/case-badges";
import { MilestoneTracker } from "@/components/onboarding/milestone-tracker";
import { StageTimeline } from "@/components/onboarding/stage-timeline";
import { BlockedDownstream, groupByBlocker } from "@/components/readiness/blocked-downstream";
import { ReadinessBadge } from "@/components/readiness/readiness-badge";
import { ReadinessPanel } from "@/components/readiness/readiness-panel";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Avatar, EmptyState, Skeleton } from "@/components/ui/misc";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useToast } from "@/components/ui/toast";
import { formatDate, formatRelative } from "@/lib/dates";
import {
  completionPercent,
  currentStage,
  getMilestones,
  isTaskComplete,
  isTaskOverdue,
  nextMilestone,
} from "@/lib/metrics";
import { getBlockedDownstream } from "@/lib/dependencies";
import { firstName } from "@/lib/portal";
import { assessReadiness } from "@/lib/readiness";
import { demoModeActions } from "@/lib/use-demo-preview";
import { onboardingActions, useOnboarding } from "@/lib/use-onboarding";
import { modulesFor, WORKFLOW_MODULES } from "@/lib/workflow-templates";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

export function CaseDetailView({ id }: { id: string }) {
  const state = useOnboarding();

  return (
    <>
      <ButtonLink href="/" variant="ghost" size="sm" className="-ml-2 mb-3">
        <ArrowLeft aria-hidden />
        Back to dashboard
      </ButtonLink>
      {!state.hydrated ? (
        <DetailSkeleton />
      ) : (
        <CaseDetailContent onboarding={state.cases.find((c) => c.id === id)} today={state.today} />
      )}
    </>
  );
}

function CaseDetailContent({ onboarding, today }: { onboarding?: OnboardingCase; today: ISODate }) {
  const router = useRouter();
  const { notify } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleted, setDeleted] = useState(false);

  useEffect(() => {
    if (onboarding) document.title = `${onboarding.employeeName} · Smart Onboarding`;
  }, [onboarding]);

  if (!onboarding) {
    // Avoid flashing "not found" while navigating away after a delete.
    if (deleted) return <DetailSkeleton />;
    return (
      <Card>
        <EmptyState
          icon={<UserX />}
          title="Onboarding case not found"
          description="It may have been deleted, or the demo data was reset in this browser."
          action={<ButtonLink href="/">Go to dashboard</ButtonLink>}
        />
      </Card>
    );
  }

  const progress = completionPercent(onboarding.tasks);
  const completed = onboarding.tasks.filter(isTaskComplete).length;
  const stage = currentStage(onboarding);
  const milestones = getMilestones(onboarding, today);
  const next = nextMilestone(onboarding, today);
  const overdue = onboarding.tasks.filter((t) => isTaskOverdue(t, today)).length;
  const blocked = onboarding.tasks.filter((t) => t.status === "Blocked").length;
  const readiness = assessReadiness(onboarding, today);

  const handlePreview = () => {
    demoModeActions.previewCase(onboarding.id);
    notify(`Previewing the portal as ${onboarding.employeeName}. This is a simulated view, not a sign-in.`);
    router.push("/");
  };

  const handleDelete = () => {
    setDeleted(true);
    setConfirmDelete(false);
    onboardingActions.deleteCase(onboarding.id);
    notify(`Onboarding case for ${onboarding.employeeName} deleted.`);
    router.push("/");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={onboarding.employeeName} size="lg" />
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-accent uppercase">Onboarding case</p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">
                {onboarding.employeeName}
              </h1>
              <p className="text-sm text-ink-soft">
                {onboarding.jobTitle} · {onboarding.department}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ReadinessBadge status={readiness.status} />
                <Badge tone="neutral">{onboarding.employmentType}</Badge>
                {modulesFor(onboarding.workflow)
                  .filter((m) => m !== "core")
                  .map((m) => (
                    <Badge key={m} tone="accent">
                      {WORKFLOW_MODULES[m].label}
                    </Badge>
                  ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 self-start">
            <Button variant="secondary" size="sm" onClick={handlePreview}>
              <Eye aria-hidden />
              Preview portal as {firstName(onboarding.employeeName)}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden />
              Delete case
            </Button>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <Detail icon={<UserRound />} label="Hiring manager" value={onboarding.hiringManager} />
          <Detail icon={<MapPin />} label="Location" value={onboarding.location} />
          <Detail
            icon={<CalendarDays />}
            label="Start date"
            value={
              <>
                <time dateTime={onboarding.startDate}>{formatDate(onboarding.startDate)}</time>
                <span className="text-muted"> · {formatRelative(onboarding.startDate, today)}</span>
              </>
            }
          />
          <Detail icon={<Briefcase />} label="Employment type" value={onboarding.employmentType} />
          <Detail icon={<UsersRound />} label="HR partner" value={onboarding.contacts.hrPartner.name} />
          <Detail icon={<HeartHandshake />} label="Onboarding buddy" value={onboarding.contacts.buddy.name} />
        </dl>
      </Card>

      <ReadinessPanel assessment={readiness} today={today} />

      {/* Summary */}
      <section aria-label="Case summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryTile label="Completion">
          <p className="text-2xl font-semibold tabular-nums">{progress}%</p>
          <ProgressBar value={progress} label={`${onboarding.employeeName} onboarding completion`} className="mt-2" />
          <p className="mt-1.5 text-xs text-muted">
            {completed} of {onboarding.tasks.length} tasks completed
          </p>
        </SummaryTile>
        <SummaryTile label="Current stage" icon={<Layers />}>
          <p className="text-lg font-semibold">{stage}</p>
          <p className="mt-1 text-xs text-muted">
            {stage === "Completed" ? "Every task is complete." : "Earliest stage with open tasks."}
          </p>
        </SummaryTile>
        <SummaryTile label="Next milestone" icon={<Flag />}>
          {next ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-semibold">{next.label}</p>
                <MilestoneStatusBadge status={next.status} />
              </div>
              <p className="mt-1 text-xs text-muted">
                {formatDate(next.date)} · {formatRelative(next.date, today)}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold">All reached</p>
              <p className="mt-1 text-xs text-muted">Day 90 milestone completed.</p>
            </>
          )}
        </SummaryTile>
        <SummaryTile label="Needs attention" icon={<AlertTriangle />}>
          <p className={overdue + blocked > 0 ? "text-2xl font-semibold text-red-700 tabular-nums" : "text-2xl font-semibold tabular-nums"}>
            {overdue + blocked}
          </p>
          <p className="mt-1 text-xs text-muted">
            {overdue} overdue · {blocked} blocked
          </p>
        </SummaryTile>
      </section>

      <BlockedDownstream groups={groupByBlocker(onboarding.id, getBlockedDownstream(onboarding, today))} hideWhenEmpty />

      <MilestoneTracker milestones={milestones} nextKey={next?.key ?? null} today={today} />

      <CaseLearningSection caseId={onboarding.id} today={today} />

      <CaseFeedbackSection onboarding={onboarding} today={today} />

      <StageTimeline onboarding={onboarding} today={today} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this onboarding case?"
        description={`The case for ${onboarding.employeeName} and all ${onboarding.tasks.length} tasks will be removed from this browser. You can restore the sample cases with “Reset demo data”.`}
        confirmLabel="Delete case"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

function Detail({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-muted [&_svg]:size-4">{icon}</span>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted">{label}</dt>
        <dd className="mt-0.5 text-sm text-ink">{value}</dd>
      </div>
    </div>
  );
}

function SummaryTile({ label, icon, children }: { label: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-muted">{label}</p>
        {icon ? <span className="text-muted [&_svg]:size-4">{icon}</span> : null}
      </div>
      {children}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading onboarding case">
      <div className="rounded-xl border border-line bg-surface p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="mt-6 h-12 w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
