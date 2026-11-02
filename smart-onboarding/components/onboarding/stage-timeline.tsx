"use client";

import { Check, ListTodo, SearchX } from "lucide-react";
import { useState } from "react";
import { DEFAULT_TASK_FILTERS, TaskFilters, type TaskFilterState } from "@/components/tasks/task-filters";
import { DependencyStateBadge, RequirementBadge, TaskDependencies } from "@/components/tasks/task-dependencies";
import { DueDate, TaskStatusSelect } from "@/components/tasks/task-status";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/dates";
import { filterTasks, isTaskComplete, needsAttention, sortTasksByDueDate } from "@/lib/metrics";
import { onboardingActions } from "@/lib/use-onboarding";
import { ONBOARDING_STAGES, type ISODate, type OnboardingCase, type OnboardingTask } from "@/types/onboarding";

const STAGE_HINT: Record<(typeof ONBOARDING_STAGES)[number], string> = {
  "Pre-boarding": "Before Day 1",
  "Day 1": "First day",
  "First 30 days": "Month one",
  "Day 60": "Month two",
  "Day 90": "Month three",
};

function TaskItem({
  task,
  onboarding,
  today,
}: {
  task: OnboardingTask;
  onboarding: OnboardingCase;
  today: ISODate;
}) {
  const caseId = onboarding.id;
  const done = isTaskComplete(task);
  const flagged = needsAttention(task, today) && task.mandatory;
  return (
    <li
      id={`task-${task.id}`}
      className={cn(
        "flex scroll-mt-24 flex-col gap-3 rounded-lg border px-4 py-3 target:ring-2 target:ring-accent sm:flex-row sm:items-start",
        flagged ? "border-red-200 bg-red-50/40" : "border-line bg-surface",
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <button
          type="button"
          onClick={() =>
            onboardingActions.setTaskStatus(caseId, task.id, done ? "Not started" : "Completed")
          }
          aria-label={done ? `Mark “${task.title}” as not started` : `Mark “${task.title}” as completed`}
          aria-pressed={done}
          className={cn(
            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
            done
              ? "border-emerald-600 bg-emerald-600 text-white"
              : "border-line-strong bg-surface text-transparent hover:border-accent hover:text-accent/40",
          )}
        >
          <Check aria-hidden className="size-3.5" strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", done ? "text-muted line-through decoration-muted/50" : "text-ink")}>
            {task.title}
          </p>
          <p className="mt-0.5 text-xs text-muted">{task.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <RequirementBadge mandatory={task.mandatory} />
            <Badge tone="neutral">{task.owner}</Badge>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted">
              Due <DueDate task={task} today={today} />
            </span>
            {task.completedAt ? (
              <span className="text-xs text-emerald-700">Completed {formatShortDate(task.completedAt)}</span>
            ) : null}
            <DependencyStateBadge onboarding={onboarding} task={task} today={today} />
          </div>
          {task.status === "Blocked" && task.blockedReason ? (
            <p className="mt-1.5 text-xs text-red-800">
              <span className="font-medium">Blocker:</span> {task.blockedReason}
            </p>
          ) : null}
          <TaskDependencies onboarding={onboarding} task={task} />
        </div>
      </div>
      <TaskStatusSelect
        task={task}
        onChange={(status) => onboardingActions.setTaskStatus(caseId, task.id, status)}
        className="sm:ml-auto"
      />
    </li>
  );
}

export function StageTimeline({ onboarding, today }: { onboarding: OnboardingCase; today: ISODate }) {
  const [filters, setFilters] = useState<TaskFilterState>(DEFAULT_TASK_FILTERS);
  const visible = filterTasks(onboarding.tasks, filters, today);

  const stages = ONBOARDING_STAGES.map((stage) => {
    const all = onboarding.tasks.filter((t) => t.stage === stage);
    const sorted = sortTasksByDueDate(all);
    return {
      stage,
      all,
      shown: sortTasksByDueDate(visible.filter((t) => t.stage === stage)),
      completed: all.filter(isTaskComplete).length,
      from: sorted[0]?.dueDate,
      to: sorted[sorted.length - 1]?.dueDate,
    };
  }).filter((s) => s.all.length > 0);

  const hasResults = stages.some((s) => s.shown.length > 0);

  return (
    <Card aria-labelledby="timeline-heading">
      <CardHeader
        id="timeline-heading"
        icon={<ListTodo />}
        title="Onboarding timeline"
        description="Tasks grouped by stage, in chronological order."
      />
      <div className="border-b border-line px-5 py-3">
        <TaskFilters value={filters} onChange={setFilters} idPrefix="case-tasks" />
      </div>

      {!hasResults ? (
        <EmptyState
          icon={<SearchX />}
          title="No tasks match these filters"
          description="Clear the filters to see the full checklist."
        />
      ) : (
        <ol className="relative px-5 py-5">
          {stages
            .filter((s) => s.shown.length > 0)
            .map((s, index, arr) => {
              const stageDone = s.completed === s.all.length;
              return (
                <li key={s.stage} className="relative pb-6 pl-9 last:pb-0">
                  {index < arr.length - 1 ? (
                    <span aria-hidden className="absolute top-7 bottom-0 left-[11px] w-px bg-line-strong" />
                  ) : null}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute top-0.5 left-0 flex size-6 items-center justify-center rounded-full text-[11px] font-semibold ring-4 ring-surface",
                      stageDone ? "bg-emerald-600 text-white" : "bg-ink text-white",
                    )}
                  >
                    {stageDone ? <Check className="size-3.5" strokeWidth={3} /> : ONBOARDING_STAGES.indexOf(s.stage) + 1}
                  </span>
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-ink">{s.stage}</h3>
                      <p className="text-xs text-muted">
                        {STAGE_HINT[s.stage]}
                        {s.from && s.to
                          ? ` · ${s.from === s.to ? formatShortDate(s.from) : `${formatShortDate(s.from)} – ${formatShortDate(s.to)}`}`
                          : null}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted tabular-nums">
                      {s.completed}/{s.all.length} completed
                    </span>
                  </div>
                  <ul className="space-y-2">
                    {s.shown.map((task) => (
                      <TaskItem key={task.id} task={task} onboarding={onboarding} today={today} />
                    ))}
                  </ul>
                </li>
              );
            })}
        </ol>
      )}
    </Card>
  );
}
