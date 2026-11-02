"use client";

import { ListChecks, SearchX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DEFAULT_TASK_FILTERS, TaskFilters, type TaskFilterState } from "@/components/tasks/task-filters";
import { DependencyStateBadge, RequirementBadge } from "@/components/tasks/task-dependencies";
import { DueDate, TaskStatusSelect } from "@/components/tasks/task-status";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { filterTasks, flattenTasks, needsAttention, sortTasksByDueDate, type CaseTask } from "@/lib/metrics";
import { onboardingActions, useOnboarding } from "@/lib/use-onboarding";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

export function TaskBoardView() {
  const state = useOnboarding();
  const [filters, setFilters] = useState<TaskFilterState>(DEFAULT_TASK_FILTERS);

  return (
    <>
      <PageHeader
        eyebrow="Task management"
        title="All onboarding tasks"
        description="Every task across all onboarding cases. Filter by status or owner, or search by employee, role, department or task."
      />
      <Card aria-labelledby="tasks-heading">
        <CardHeader
          id="tasks-heading"
          icon={<ListChecks />}
          title="Tasks"
          description={
            state.hydrated
              ? `${state.cases.reduce((n, c) => n + c.tasks.length, 0)} tasks across ${state.cases.length} cases`
              : "Loading…"
          }
        />
        <div className="border-b border-line px-5 py-3">
          <TaskFilters
            value={filters}
            onChange={setFilters}
            idPrefix="all-tasks"
            searchPlaceholder="Search employee, role, department or task"
          />
        </div>
        {state.hydrated ? (
          <TaskList
            tasks={sortTasksByDueDate(filterTasks(flattenTasks(state.cases), filters, state.today))}
            today={state.today}
            cases={state.cases}
          />
        ) : (
          <div className="space-y-3 p-5" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function TaskList({ tasks, today, cases }: { tasks: CaseTask[]; today: ISODate; cases: OnboardingCase[] }) {
  const caseById = new Map(cases.map((c) => [c.id, c]));
  const meta = (task: CaseTask) => (
    <span className="mt-1 flex flex-wrap items-center gap-1.5">
      <RequirementBadge mandatory={task.mandatory} />
      <DependencyStateBadge onboarding={caseById.get(task.caseId)!} task={task} today={today} />
    </span>
  );
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<SearchX />}
        title="No tasks match"
        description="Try a different search term, status or owner."
      />
    );
  }

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {tasks.length} tasks shown
      </p>
      {/* Mobile list */}
      <ul className="divide-y divide-line md:hidden">
        {tasks.map((task) => (
          <li key={task.id} className={cn("space-y-2 px-5 py-4", needsAttention(task, today) && "bg-red-50/40")}>
            <p className="text-sm font-medium text-ink">{task.title}</p>
            {meta(task)}
            <p className="text-xs text-muted">
              <Link href={`/onboarding/${task.caseId}`} className="font-medium text-accent hover:underline">
                {task.employeeName}
              </Link>{" "}
              · {task.owner} · {task.stage}
            </p>
            <div className="flex items-center justify-between gap-3">
              <DueDate task={task} today={today} />
              <TaskStatusSelect
                task={task}
                onChange={(status) => onboardingActions.setTaskStatus(task.caseId, task.id, status)}
              />
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-subtle text-xs tracking-wide text-muted uppercase">
            <tr>
              <th scope="col" className="px-5 py-2.5 font-medium">Task</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Employee</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Owner</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Stage</th>
              <th scope="col" className="px-3 py-2.5 font-medium">Due</th>
              <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {tasks.map((task) => (
              <tr key={task.id} className={cn(needsAttention(task, today) && "bg-red-50/40")}>
                <td className="max-w-xs px-5 py-3 font-medium text-ink">
                  {task.title}
                  {meta(task)}
                </td>
                <td className="px-3 py-3">
                  <Link
                    href={`/onboarding/${task.caseId}`}
                    className="font-medium whitespace-nowrap text-accent hover:text-accent-strong hover:underline"
                  >
                    {task.employeeName}
                  </Link>
                  <p className="text-xs text-muted">{task.department}</p>
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-ink-soft">{task.owner}</td>
                <td className="px-3 py-3 whitespace-nowrap text-ink-soft">{task.stage}</td>
                <td className="px-3 py-3 whitespace-nowrap">
                  <DueDate task={task} today={today} />
                </td>
                <td className="px-5 py-3">
                  <TaskStatusSelect
                    task={task}
                    onChange={(status) => onboardingActions.setTaskStatus(task.caseId, task.id, status)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
