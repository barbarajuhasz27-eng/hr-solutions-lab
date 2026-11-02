import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import {
  READINESS_DESCRIPTION,
  READINESS_ICON,
  READINESS_SOLID,
} from "@/components/readiness/readiness-badge";
import { Card, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { READINESS_STATUSES, type ReadinessStatus } from "@/lib/readiness";

/** Count of active cases per readiness status, each linking to the filtered overview. */
export function ReadinessOverview({
  counts,
  activeCases,
}: {
  counts: Record<ReadinessStatus, number>;
  activeCases: number;
}) {
  return (
    <Card aria-labelledby="readiness-overview-heading">
      <CardHeader
        id="readiness-overview-heading"
        icon={<ShieldCheck />}
        title="Readiness for the next milestone"
        description={`Rule-based readiness of ${activeCases} active ${activeCases === 1 ? "onboarding" : "onboardings"}. Select a status to see why.`}
      />
      <ul className="grid gap-px overflow-hidden rounded-b-xl bg-line sm:grid-cols-2 xl:grid-cols-4">
        {READINESS_STATUSES.map((status) => {
          const Icon = READINESS_ICON[status];
          const count = counts[status];
          return (
            <li key={status} className="bg-surface">
              <Link
                href={`/readiness?status=${encodeURIComponent(status)}`}
                className="group flex h-full items-start gap-3 p-5 transition-colors hover:bg-subtle"
                aria-label={`${count} ${status}: view cases`}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    count > 0 ? READINESS_SOLID[status] : "bg-slate-100 text-slate-500",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-ink tabular-nums">{count}</span>
                    <span className="text-sm font-medium text-ink">{status}</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{READINESS_DESCRIPTION[status]}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
