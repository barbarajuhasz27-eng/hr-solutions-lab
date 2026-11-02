import { AlertCircle, CheckCircle2, Circle, CircleDashed, Info } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { diffInDays, formatShortDate } from "@/lib/dates";
import { checkpointLabel, type AssignmentProgress, type LearningStatus } from "@/lib/learning";
import { LEARNING_DISCLAIMER } from "@/lib/learning-catalog";
import type { LearningAssignment } from "@/types/learning";
import type { ISODate } from "@/types/onboarding";

const STATUS_TONE: Record<LearningStatus, Tone> = {
  Completed: "success",
  Overdue: "danger",
  "In progress": "info",
  "Not started": "neutral",
};

const STATUS_ICON: Record<LearningStatus, typeof Circle> = {
  Completed: CheckCircle2,
  Overdue: AlertCircle,
  "In progress": CircleDashed,
  "Not started": Circle,
};

export function LearningStatusBadge({ status }: { status: LearningStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={STATUS_TONE[status]} icon={<Icon aria-hidden />}>
      {status}
    </Badge>
  );
}

/** The required notice shown on every learning module. */
export function LearningDisclaimer({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 text-amber-950",
        compact ? "px-2.5 py-1.5 text-xs" : "px-3.5 py-2.5 text-sm",
        className,
      )}
    >
      <Info aria-hidden className={cn("mt-0.5 shrink-0 text-amber-700", compact ? "size-3.5" : "size-4")} />
      <span>
        <strong className="font-semibold">{LEARNING_DISCLAIMER}.</strong>
        {compact ? null : " Written for this demo. Your organisation's own policies always take precedence."}
      </span>
    </p>
  );
}

/** "Due Day 7 · 9 Nov" with a relative hint for open assignments. */
export function DueLabel({ assignment, today }: { assignment: LearningAssignment; today: ISODate }) {
  const days = diffInDays(today, assignment.dueDate);
  const open = !assignment.completedAt;
  return (
    <span className="text-xs text-muted">
      {checkpointLabel(assignment.checkpoint)} · due <time dateTime={assignment.dueDate}>{formatShortDate(assignment.dueDate)}</time>
      {open && days < 0 ? <span className="font-medium text-red-700"> · {Math.abs(days)} days overdue</span> : null}
      {open && days === 0 ? <span className="font-medium text-amber-800"> · due today</span> : null}
      {open && days > 0 && days <= 7 ? <span className="font-medium text-amber-800"> · in {days} days</span> : null}
    </span>
  );
}

/** "2 of 3 lessons · quiz passed (2 attempts)". Scores of individual attempts are not shown. */
export function progressText(progress: AssignmentProgress): string {
  const lessons = `${progress.lessonsViewed} of ${progress.lessonCount} lessons`;
  if (!progress.hasQuiz) return `${lessons} · no quiz`;
  const attempts = progress.attempts === 1 ? "1 attempt" : `${progress.attempts} attempts`;
  if (progress.quizPassed) return `${lessons} · quiz passed (${attempts})`;
  if (progress.attempts > 0) return `${lessons} · quiz not passed yet (${attempts})`;
  return `${lessons} · quiz not taken`;
}
