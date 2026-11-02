"use client";

import { ArrowRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import { DueLabel, LearningStatusBadge } from "@/components/learning/learning-ui";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { assignmentProgress, assignmentsForCase, assignmentStatus, isAssignmentComplete, nextAssignments } from "@/lib/learning";
import { getModule, LEARNING_DISCLAIMER } from "@/lib/learning-catalog";
import { useLearning } from "@/lib/use-learning";
import type { ISODate } from "@/types/onboarding";

/** "Your learning" on the portal home: mandatory progress and the next modules to work on. */
export function PortalLearningCard({ caseId, today }: { caseId: string; today: ISODate }) {
  const learning = useLearning();
  if (!learning.hydrated) return null;
  const own = assignmentsForCase(learning.assignments, caseId);
  if (own.length === 0) return null;
  const mandatory = own.filter((a) => a.mandatory);
  const done = mandatory.filter(isAssignmentComplete).length;
  const next = nextAssignments(own, today, 3);

  return (
    <Card aria-labelledby="portal-learning">
      <CardHeader
        id="portal-learning"
        title="Your learning"
        description={`${done} of ${mandatory.length} mandatory modules done`}
        icon={<GraduationCap />}
        action={
          <ButtonLink href="/me/learning" variant="ghost" size="sm">
            Learning Center
            <ArrowRight aria-hidden />
          </ButtonLink>
        }
      />
      <div className="px-5 pt-4">
        <ProgressBar
          value={mandatory.length === 0 ? 0 : Math.round((done / mandatory.length) * 100)}
          label="Mandatory modules done"
          size="sm"
        />
      </div>
      {next.length > 0 ? (
        <ul className="divide-y divide-line px-5 py-1">
          {next.map((a) => {
            const learningModule = getModule(a.moduleId);
            const progress = assignmentProgress(a, learningModule);
            return (
              <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/me/learning/${a.moduleId}`}
                    className="text-sm font-medium text-ink hover:text-accent-strong hover:underline"
                  >
                    {learningModule.title}
                  </Link>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2">
                    <DueLabel assignment={a} today={today} />
                    <span className="text-xs text-muted">· {progress.percent}% done</span>
                    {!a.mandatory ? <span className="text-xs text-muted">· optional</span> : null}
                  </div>
                </div>
                <LearningStatusBadge status={assignmentStatus(a, today)} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-5 py-4 text-sm text-muted">All your modules are done. Nice work.</p>
      )}
      <p className="border-t border-line px-5 py-3 text-xs text-muted">{LEARNING_DISCLAIMER}.</p>
    </Card>
  );
}
