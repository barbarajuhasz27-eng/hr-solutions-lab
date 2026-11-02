"use client";

import { GraduationCap, Info } from "lucide-react";
import { DueLabel, LearningStatusBadge, progressText } from "@/components/learning/learning-ui";
import { RequirementBadge } from "@/components/tasks/task-dependencies";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatShortDate } from "@/lib/dates";
import {
  assignmentProgress,
  assignmentsForCase,
  assignmentStatus,
  isAssignmentComplete,
  isAssignmentOverdue,
} from "@/lib/learning";
import { getModule, LEARNING_DISCLAIMER } from "@/lib/learning-catalog";
import { useLearning } from "@/lib/use-learning";
import type { ISODate } from "@/types/onboarding";

/** Learning progress for one employee, shown on the HR case page. Read-only for HR. */
export function CaseLearningSection({ caseId, today }: { caseId: string; today: ISODate }) {
  const learning = useLearning();
  if (!learning.hydrated) return null;
  const own = assignmentsForCase(learning.assignments, caseId);
  const mandatory = own.filter((a) => a.mandatory);
  const done = mandatory.filter(isAssignmentComplete).length;
  const overdue = own.filter((a) => isAssignmentOverdue(a, today)).length;

  return (
    <Card aria-labelledby="case-learning">
      <CardHeader
        id="case-learning"
        title="Learning progress"
        description={`${done} of ${mandatory.length} mandatory modules completed`}
        icon={<GraduationCap />}
        action={overdue > 0 ? <Badge tone="danger">{overdue} overdue</Badge> : null}
      />
      {own.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted">No learning modules are assigned to this case.</p>
      ) : (
        <ul className="divide-y divide-line px-5">
          {own.map((a) => {
            const learningModule = getModule(a.moduleId);
            const progress = assignmentProgress(a, learningModule);
            return (
              <li key={a.id} className="grid gap-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-ink">{learningModule.title}</p>
                    <LearningStatusBadge status={assignmentStatus(a, today)} />
                    <RequirementBadge mandatory={a.mandatory} />
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2">
                    <DueLabel assignment={a} today={today} />
                    {a.completedAt ? (
                      <span className="text-xs text-muted">
                        · completed <time dateTime={a.completedAt}>{formatShortDate(a.completedAt)}</time>
                      </span>
                    ) : null}
                  </div>
                </div>
                <div>
                  <ProgressBar value={progress.percent} label={`${learningModule.title} progress`} size="sm" />
                  <p className="mt-1 text-xs text-muted">{progressText(progress)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex gap-1.5 border-t border-line bg-subtle px-5 py-3 text-xs leading-relaxed text-muted">
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          Learning is reported separately and does not change the readiness status. Only the employee can record
          their own learning progress. {LEARNING_DISCLAIMER}.
        </span>
      </p>
    </Card>
  );
}
