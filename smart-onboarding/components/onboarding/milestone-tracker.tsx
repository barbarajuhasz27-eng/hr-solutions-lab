import { AlertTriangle, Check, Clock, Flag } from "lucide-react";
import { MilestoneStatusBadge } from "@/components/onboarding/case-badges";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { formatDate, formatRelative } from "@/lib/dates";
import type { Milestone, MilestoneStatus } from "@/lib/metrics";
import type { ISODate } from "@/types/onboarding";

const DOT: Record<MilestoneStatus, string> = {
  Completed: "bg-emerald-600 text-white ring-emerald-100",
  Overdue: "bg-red-600 text-white ring-red-100",
  "Due soon": "bg-amber-500 text-white ring-amber-100",
  Upcoming: "bg-surface text-muted ring-line border border-line-strong",
};

function DotIcon({ status }: { status: MilestoneStatus }) {
  if (status === "Completed") return <Check aria-hidden className="size-4" />;
  if (status === "Overdue") return <AlertTriangle aria-hidden className="size-4" />;
  if (status === "Due soon") return <Clock aria-hidden className="size-4" />;
  return <Flag aria-hidden className="size-4" />;
}

export function MilestoneTracker({
  milestones,
  nextKey,
  today,
}: {
  milestones: Milestone[];
  nextKey: string | null;
  today: ISODate;
}) {
  return (
    <Card aria-labelledby="milestones-heading">
      <CardHeader
        id="milestones-heading"
        icon={<Flag />}
        title="Milestones"
        description="A milestone is reached when every mandatory task in its stages, and each mandatory prerequisite, is completed. Day 1 includes pre-boarding. Optional tasks never gate a milestone."
      />
      <ol className="grid gap-px overflow-hidden rounded-b-xl bg-line sm:grid-cols-2 xl:grid-cols-4">
        {milestones.map((m) => {
          const isNext = m.key === nextKey;
          return (
            <li
              key={m.key}
              className={cn("relative bg-surface p-5", isNext && "bg-accent-soft/40")}
              aria-current={isNext ? "step" : undefined}
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full ring-4",
                    DOT[m.status],
                  )}
                >
                  <DotIcon status={m.status} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {m.label}
                    {isNext ? (
                      <span className="ml-2 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                        Next
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted">
                    <time dateTime={m.date}>{formatDate(m.date)}</time> · {formatRelative(m.date, today)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <MilestoneStatusBadge status={m.status} />
                <span className="text-xs text-muted tabular-nums">
                  {m.completedTasks}/{m.totalTasks} mandatory{m.optionalTasks > 0 ? ` · ${m.optionalTasks} optional` : ""}
                </span>
                {m.blockedTasks > 0 ? (
                  <span className="text-xs font-medium text-red-700">{m.blockedTasks} blocked</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
