import { ArrowRight, GitBranch } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import type { BlockedDownstreamItem } from "@/lib/dependencies";
import type { OnboardingTask } from "@/types/onboarding";

export type BlockerGroup = {
  caseId: string;
  employeeName?: string;
  blocker: OnboardingTask;
  cause: BlockedDownstreamItem["cause"];
  downstream: OnboardingTask[];
};

/** Groups downstream items by the upstream task that holds them up. */
export function groupByBlocker(
  caseId: string,
  items: BlockedDownstreamItem[],
  employeeName?: string,
): BlockerGroup[] {
  const groups = new Map<string, BlockerGroup>();
  for (const item of items) {
    const group = groups.get(item.blocker.id) ?? {
      caseId,
      employeeName,
      blocker: item.blocker,
      cause: item.cause,
      downstream: [],
    };
    group.downstream.push(item.task);
    groups.set(item.blocker.id, group);
  }
  return [...groups.values()];
}

/** Visual chains of upstream blockers and the downstream tasks they hold up. */
export function BlockedDownstream({
  groups,
  showEmployee = false,
  hideWhenEmpty = false,
}: {
  groups: BlockerGroup[];
  showEmployee?: boolean;
  hideWhenEmpty?: boolean;
}) {
  if (hideWhenEmpty && groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.downstream.length, 0);

  return (
    <Card aria-labelledby="downstream-heading">
      <CardHeader
        id="downstream-heading"
        icon={<GitBranch />}
        title="Blocked downstream tasks"
        description="Tasks that cannot progress because a mandatory prerequisite is blocked or overdue."
        action={total > 0 ? <Badge tone="danger">{total} held up</Badge> : null}
      />
      {groups.length === 0 ? (
        <EmptyState
          icon={<GitBranch />}
          title="No downstream tasks are held up"
          description="Every open task's mandatory prerequisites are on schedule and unblocked."
        />
      ) : (
        <ul className="divide-y divide-line">
          {groups.map((g) => {
            const href = (task: OnboardingTask) => `/onboarding/${g.caseId}#task-${task.id}`;
            return (
              <li key={g.blocker.id} className="px-5 py-4">
                {showEmployee && g.employeeName ? (
                  <Link href={`/onboarding/${g.caseId}`} className="text-xs font-semibold text-accent hover:underline">
                    {g.employeeName}
                  </Link>
                ) : null}
                <div className="mt-1 flex flex-col gap-2 md:flex-row md:items-start">
                  <div className="min-w-0 rounded-lg border border-red-200 bg-red-50 px-3 py-2 md:w-72 md:shrink-0">
                    <p className="text-xs font-medium text-red-800">
                      {g.cause === "blocked" ? "Blocked" : "Overdue"} · {g.blocker.owner}
                    </p>
                    <Link href={href(g.blocker)} className="text-sm font-medium text-red-950 hover:underline">
                      {g.blocker.title}
                    </Link>
                    {g.blocker.blockedReason && g.cause === "blocked" ? (
                      <p className="mt-0.5 text-xs text-red-800">{g.blocker.blockedReason}</p>
                    ) : null}
                  </div>
                  <ArrowRight aria-hidden className="mx-auto size-4 shrink-0 rotate-90 text-muted md:mx-0 md:mt-3 md:rotate-0" />
                  <ul className="flex min-w-0 flex-1 flex-wrap gap-1.5" aria-label={`Held up by ${g.blocker.title}`}>
                    {g.downstream.map((task) => (
                      <li key={task.id}>
                        <Link
                          href={href(task)}
                          className="inline-flex items-center gap-1 rounded-md border border-line-strong bg-surface px-2 py-1 text-xs text-ink-soft hover:border-accent hover:text-ink"
                        >
                          {task.title}
                          <span className="text-muted">· {task.owner}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
