"use client";

import { AlertOctagon, AlertTriangle, CircleCheckBig } from "lucide-react";
import Link from "next/link";
import { DueDate, TaskStatusSelect } from "@/components/tasks/task-status";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import type { CriticalTaskItem } from "@/lib/readiness";
import { onboardingActions } from "@/lib/use-onboarding";
import type { ISODate } from "@/types/onboarding";

/** Mandatory tasks that put readiness at risk, across all cases. */
export function CriticalTasksList({
  items,
  today,
  limit,
}: {
  items: CriticalTaskItem[];
  today: ISODate;
  /** Show only the first N items, with a link to the full readiness overview. */
  limit?: number;
}) {
  const shown = limit ? items.slice(0, limit) : items;
  const critical = items.filter((i) => i.severity === "critical").length;

  return (
    <Card aria-labelledby="critical-heading" className="flex flex-col">
      <CardHeader
        id="critical-heading"
        icon={<AlertOctagon />}
        title="Critical outstanding tasks"
        description="Mandatory tasks that are overdue, blocked, held up upstream or due within 7 days."
        action={
          items.length > 0 ? (
            <Badge tone={critical > 0 ? "danger" : "warning"}>
              {critical} critical · {items.length - critical} due soon
            </Badge>
          ) : null
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={<CircleCheckBig />}
          title="No critical outstanding tasks"
          description="No mandatory task is overdue, blocked or due within the next 7 days."
        />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {shown.map(({ task, caseId, employeeName, severity, flags }) => (
              <li key={task.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <span
                  aria-hidden
                  className={
                    severity === "critical"
                      ? "hidden size-8 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-700 sm:flex"
                      : "hidden size-8 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-700 sm:flex"
                  }
                >
                  {severity === "critical" ? <AlertOctagon className="size-4" /> : <AlertTriangle className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{task.title}</p>
                  <p className="mt-0.5 text-sm text-muted">
                    <Link
                      href={`/onboarding/${caseId}#task-${task.id}`}
                      className="font-medium text-accent hover:text-accent-strong hover:underline"
                    >
                      {employeeName}
                    </Link>
                    <span aria-hidden> · </span>
                    <span>{task.owner}</span>
                    <span aria-hidden> · </span>
                    <span>{task.stage}</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted">Due</span>
                    <DueDate task={task} today={today} />
                    {flags
                      .filter((f) => !f.startsWith("Overdue") && !f.startsWith("Due"))
                      .map((flag) => (
                        <Badge key={flag} tone={severity === "critical" ? "danger" : "warning"}>
                          {flag}
                        </Badge>
                      ))}
                  </div>
                </div>
                <TaskStatusSelect
                  task={task}
                  onChange={(status) => onboardingActions.setTaskStatus(caseId, task.id, status)}
                />
              </li>
            ))}
          </ul>
          {limit && items.length > limit ? (
            <div className="border-t border-line px-5 py-3">
              <ButtonLink href="/readiness" variant="ghost" size="sm" className="-ml-2">
                View all {items.length} in Readiness &amp; risk
              </ButtonLink>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
