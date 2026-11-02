"use client";

import { AlertCircle, Ban, CheckCircle2, Circle, CircleDashed, Clock } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { SelectInput } from "@/components/ui/form-controls";
import { cn } from "@/lib/cn";
import { diffInDays, formatShortDate } from "@/lib/dates";
import { isTaskDueSoon, isTaskOverdue } from "@/lib/metrics";
import { TASK_STATUSES, type ISODate, type OnboardingTask, type TaskStatus } from "@/types/onboarding";

export const STATUS_TONE: Record<TaskStatus, Tone> = {
  "Not started": "neutral",
  "In progress": "info",
  Completed: "success",
  Blocked: "danger",
};

const STATUS_ICON: Record<TaskStatus, typeof Circle> = {
  "Not started": Circle,
  "In progress": CircleDashed,
  Completed: CheckCircle2,
  Blocked: Ban,
};

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const Icon = STATUS_ICON[status];
  return (
    <Badge tone={STATUS_TONE[status]} icon={<Icon aria-hidden />}>
      {status}
    </Badge>
  );
}

const SELECT_TONE: Record<TaskStatus, string> = {
  "Not started": "[&_select]:bg-surface",
  "In progress": "[&_select]:bg-sky-50 [&_select]:text-sky-900",
  Completed: "[&_select]:bg-emerald-50 [&_select]:text-emerald-900",
  Blocked: "[&_select]:bg-red-50 [&_select]:text-red-900",
};

export function TaskStatusSelect({
  task,
  onChange,
  className,
}: {
  task: Pick<OnboardingTask, "id" | "title" | "status">;
  onChange: (status: TaskStatus) => void;
  className?: string;
}) {
  return (
    <SelectInput
      size="sm"
      aria-label={`Status for “${task.title}”`}
      value={task.status}
      onChange={(event) => onChange(event.target.value as TaskStatus)}
      className={cn("w-[9.5rem]", SELECT_TONE[task.status], className)}
    >
      {TASK_STATUSES.map((status) => (
        <option key={status} value={status}>
          {status}
        </option>
      ))}
    </SelectInput>
  );
}

/** Due date with a derived Overdue / Due soon label. Completed tasks are never overdue. */
export function DueDate({ task, today }: { task: OnboardingTask; today: ISODate }) {
  const overdue = isTaskOverdue(task, today);
  const dueSoon = !overdue && isTaskDueSoon(task, today);
  const days = diffInDays(today, task.dueDate);

  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <time
        dateTime={task.dueDate}
        className={cn(
          "text-sm tabular-nums",
          task.status === "Completed" ? "text-muted" : "text-ink-soft",
        )}
      >
        {formatShortDate(task.dueDate)}
      </time>
      {overdue ? (
        <Badge tone="danger" icon={<AlertCircle aria-hidden />}>
          Overdue {Math.abs(days)}d
        </Badge>
      ) : dueSoon ? (
        <Badge tone="warning" icon={<Clock aria-hidden />}>
          {days === 0 ? "Due today" : `Due in ${days}d`}
        </Badge>
      ) : null}
    </span>
  );
}
