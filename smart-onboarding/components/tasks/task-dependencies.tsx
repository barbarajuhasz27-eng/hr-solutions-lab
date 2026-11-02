import { ArrowDownRight, Ban, CheckCircle2, Circle, CircleDashed, Hourglass, Link2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { getDependencyStatus, getDependents, getPrerequisites } from "@/lib/dependencies";
import type { ISODate, OnboardingCase, OnboardingTask, TaskStatus } from "@/types/onboarding";

export function RequirementBadge({ mandatory }: { mandatory: boolean }) {
  return mandatory ? (
    <Badge tone="neutral" icon={<Lock aria-hidden />} className="bg-ink/5 text-ink ring-ink/15">
      Mandatory
    </Badge>
  ) : (
    <Badge tone="neutral" className="bg-transparent text-muted ring-line-strong">
      Optional
    </Badge>
  );
}

const STATUS_ICON: Record<TaskStatus, typeof Circle> = {
  "Not started": Circle,
  "In progress": CircleDashed,
  Completed: CheckCircle2,
  Blocked: Ban,
};

const STATUS_CHIP: Record<TaskStatus, string> = {
  "Not started": "border-line-strong text-ink-soft",
  "In progress": "border-sky-200 bg-sky-50 text-sky-900",
  Completed: "border-emerald-200 bg-emerald-50 text-emerald-900",
  Blocked: "border-red-200 bg-red-50 text-red-900",
};

function TaskChip({ task, linkable }: { task: OnboardingTask; linkable: boolean }) {
  const Icon = STATUS_ICON[task.status];
  const content = (
    <>
      <Icon aria-hidden className="size-3 shrink-0" />
      <span className="truncate">{task.title}</span>
      <span className="sr-only">
        ({task.status}, {task.owner}
        {task.mandatory ? "" : ", optional"})
      </span>
    </>
  );
  const className = cn(
    "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs",
    STATUS_CHIP[task.status],
  );
  return linkable ? (
    <a href={`#task-${task.id}`} className={cn(className, "hover:underline")}>
      {content}
    </a>
  ) : (
    <span className={className}>{content}</span>
  );
}

/** Dependency state badge: waiting on a prerequisite, or held up by an upstream problem. */
export function DependencyStateBadge({
  onboarding,
  task,
  today,
}: {
  onboarding: Pick<OnboardingCase, "tasks">;
  task: OnboardingTask;
  today: ISODate;
}) {
  if (task.status === "Completed") return null;
  const status = getDependencyStatus(onboarding, task, today);
  if (status.state === "blocked-upstream") {
    const blocker = status.blockers[0];
    return (
      <Badge tone="danger" icon={<Ban aria-hidden />}>
        Held up by “{blocker.title}”
      </Badge>
    );
  }
  if (status.state === "waiting") {
    return (
      <Badge tone="warning" icon={<Hourglass aria-hidden />}>
        Waiting on {status.waitingOn.length === 1 ? "prerequisite" : `${status.waitingOn.length} prerequisites`}
      </Badge>
    );
  }
  return null;
}

/** "Depends on" and "Unblocks" rows for a task, with each related task's current status. */
export function TaskDependencies({
  onboarding,
  task,
  linkable = true,
}: {
  onboarding: Pick<OnboardingCase, "tasks">;
  task: OnboardingTask;
  linkable?: boolean;
}) {
  const prerequisites = getPrerequisites(onboarding.tasks, task);
  const dependents = getDependents(onboarding.tasks, task);
  if (prerequisites.length === 0 && dependents.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5 rounded-lg bg-subtle px-2.5 py-2 ring-1 ring-line">
      {prerequisites.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
            <Link2 aria-hidden className="size-3" />
            Depends on
          </span>
          {prerequisites.map((p) => (
            <TaskChip key={p.id} task={p} linkable={linkable} />
          ))}
        </div>
      ) : null}
      {dependents.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted">
            <ArrowDownRight aria-hidden className="size-3" />
            Unblocks
          </span>
          {dependents.map((d) => (
            <TaskChip key={d.id} task={d} linkable={linkable} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
