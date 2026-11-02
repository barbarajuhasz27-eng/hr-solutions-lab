"use client";

import { CheckCircle2, Circle, CircleDashed, Clock, Lock, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { canEditTask, type Viewer } from "@/lib/access";
import { formatShortDate } from "@/lib/dates";
import type { EmployeeTask, EmployeeTaskState } from "@/lib/portal";
import { onboardingActions } from "@/lib/use-onboarding";

const STATE_ICON: Record<EmployeeTaskState, typeof Circle> = {
  Done: CheckCircle2,
  "In progress": CircleDashed,
  "Not started": Circle,
  Delayed: Clock,
};

const STATE_ICON_CLASS: Record<EmployeeTaskState, string> = {
  Done: "text-emerald-600",
  "In progress": "text-sky-600",
  "Not started": "text-line-strong",
  Delayed: "text-amber-600",
};

/**
 * One onboarding step in the employee portal. Steps owned by the new employee can be marked
 * as done (or undone); everyone else's steps are shown read-only.
 */
export function EmployeeTaskItem({
  task,
  caseId,
  viewer,
  showDescription = false,
}: {
  task: EmployeeTask;
  caseId: string;
  viewer: Viewer;
  showDescription?: boolean;
}) {
  const { notify } = useToast();
  const editable = canEditTask(viewer, { id: caseId }, task);
  const Icon = STATE_ICON[task.state];
  const done = task.state === "Done";

  const setDone = (value: boolean) => {
    onboardingActions.setTaskStatusAs(viewer, caseId, task.id, value ? "Completed" : "Not started");
    notify(value ? `Nice work: “${task.title}” is done.` : `“${task.title}” is open again.`);
  };

  return (
    <li className="flex items-start gap-3 py-3">
      <Icon aria-hidden className={cn("mt-0.5 size-5 shrink-0", STATE_ICON_CLASS[task.state])} />
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium", done ? "text-ink-soft" : "text-ink")}>{task.title}</p>
        {showDescription ? <p className="mt-0.5 text-sm text-muted">{task.description}</p> : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Badge tone={task.isOwn ? "accent" : "neutral"}>{task.isOwn ? "For you" : task.ownerLabel}</Badge>
          {done && task.completedAt ? (
            <span>
              Done <time dateTime={task.completedAt}>{formatShortDate(task.completedAt)}</time>
            </span>
          ) : (
            <span>
              Planned for <time dateTime={task.dueDate}>{formatShortDate(task.dueDate)}</time>
            </span>
          )}
          {!task.mandatory ? <Badge tone="neutral">Optional</Badge> : null}
          {task.pastDue ? <Badge tone="warning">Past the planned date</Badge> : null}
          {!task.isOwn && task.state !== "Not started" ? (
            <Badge tone={task.state === "Done" ? "success" : task.state === "Delayed" ? "warning" : "info"}>
              {task.state === "Delayed" ? "Delayed: HR is following up" : task.state}
            </Badge>
          ) : null}
          {task.isOwn && task.state === "In progress" ? <Badge tone="info">In progress</Badge> : null}
        </div>
      </div>
      <div className="shrink-0">
        {editable ? (
          done ? (
            <Button variant="ghost" size="sm" onClick={() => setDone(false)} aria-label={`Undo “${task.title}”`}>
              <RotateCcw aria-hidden />
              Undo
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setDone(true)} aria-label={`Mark “${task.title}” as done`}>
              <CheckCircle2 aria-hidden />
              Mark as done
            </Button>
          )
        ) : (
          <span className="flex items-center gap-1 pt-1 text-xs text-muted" title={`Handled by ${task.ownerLabel}`}>
            <Lock aria-hidden className="size-3.5" />
            <span className="sr-only">Read-only, handled by {task.ownerLabel}</span>
          </span>
        )}
      </div>
    </li>
  );
}
