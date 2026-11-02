import { AlertOctagon, AlertTriangle, Check, Gauge, X } from "lucide-react";
import {
  READINESS_DESCRIPTION,
  READINESS_ICON,
  READINESS_SOLID,
} from "@/components/readiness/readiness-badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatDate, formatRelative } from "@/lib/dates";
import type { ReadinessAssessment } from "@/lib/readiness";
import type { ISODate } from "@/types/onboarding";

/** Full readiness explanation for one case: status, reasons and the rule checklist. */
export function ReadinessPanel({ assessment, today }: { assessment: ReadinessAssessment; today: ISODate }) {
  const { status, milestone, headline, reasons, rules, requiredTasks, requiredCompleted } = assessment;
  const Icon = READINESS_ICON[status];
  const critical = reasons.filter((r) => r.severity === "critical");
  const warnings = reasons.filter((r) => r.severity === "warning");

  return (
    <Card aria-labelledby="readiness-heading" className="overflow-hidden">
      <div className="grid lg:grid-cols-5">
        {/* Status and reasons */}
        <div className="p-5 sm:p-6 lg:col-span-3">
          <div className="flex items-start gap-4">
            <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", READINESS_SOLID[status])}>
              <Icon aria-hidden className="size-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wider text-muted uppercase">
                Readiness{milestone ? ` for ${milestone.label}` : ""}
              </p>
              <h2 id="readiness-heading" className="text-xl font-semibold text-ink">
                {status}
              </h2>
              <p className="mt-0.5 text-sm text-ink-soft">{headline}</p>
              {milestone ? (
                <p className="mt-1 text-xs text-muted">
                  {milestone.label} · {formatDate(milestone.date)} ({formatRelative(milestone.date, today)}) ·{" "}
                  {requiredCompleted}/{requiredTasks.length} required mandatory tasks completed
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-ink">Why this status</h3>
            {reasons.length === 0 ? (
              <p className="mt-2 text-sm text-muted">{READINESS_DESCRIPTION[status]}</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {[...critical, ...warnings].map((reason, index) => (
                  <li
                    key={`${reason.kind}-${reason.taskId ?? index}`}
                    className={cn(
                      "flex gap-2.5 rounded-lg px-3 py-2 text-sm",
                      reason.severity === "critical" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900",
                    )}
                  >
                    {reason.severity === "critical" ? (
                      <AlertOctagon aria-hidden className="mt-0.5 size-4 shrink-0 text-red-600" />
                    ) : (
                      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    )}
                    <span>
                      <span className="sr-only">{reason.severity === "critical" ? "Critical: " : "Warning: "}</span>
                      {reason.message}
                      {reason.taskId ? (
                        <>
                          {" "}
                          <a href={`#task-${reason.taskId}`} className="font-medium underline underline-offset-2">
                            View task
                          </a>
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Rule checklist */}
        <div className="border-t border-line bg-subtle p-5 sm:p-6 lg:col-span-2 lg:border-t-0 lg:border-l">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
            <Gauge aria-hidden className="size-4 text-muted" />
            Readiness rules
          </h3>
          <p className="mt-1 text-xs text-muted">
            Evaluated in order. The first group with a failing rule sets the status. No weighted scores.
          </p>
          <ul className="mt-3 space-y-2">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-2.5 text-sm">
                <span
                  className={cn(
                    "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full",
                    rule.passed ? "bg-emerald-600 text-white" : rule.failsTo === "On track" ? "bg-sky-600 text-white" : rule.failsTo === "At risk" ? "bg-amber-500 text-white" : "bg-red-600 text-white",
                  )}
                >
                  {rule.passed ? <Check aria-hidden className="size-3" strokeWidth={3} /> : <X aria-hidden className="size-3" strokeWidth={3} />}
                </span>
                <span className={rule.passed ? "text-ink-soft" : "font-medium text-ink"}>
                  <span className="sr-only">{rule.passed ? "Passed: " : "Failed: "}</span>
                  {rule.label}
                  {!rule.passed ? <span className="block text-xs font-normal text-muted">Fails to {rule.failsTo}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
