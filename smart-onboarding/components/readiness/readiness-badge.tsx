import { AlertTriangle, CheckCircle2, CircleDot, XCircle } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type { ReadinessStatus } from "@/lib/readiness";

export const READINESS_TONE: Record<ReadinessStatus, Tone> = {
  "Not ready": "danger",
  "At risk": "warning",
  "On track": "info",
  Ready: "success",
};

export const READINESS_ICON: Record<ReadinessStatus, typeof CircleDot> = {
  "Not ready": XCircle,
  "At risk": AlertTriangle,
  "On track": CircleDot,
  Ready: CheckCircle2,
};

export const READINESS_DESCRIPTION: Record<ReadinessStatus, string> = {
  "Not ready": "A mandatory task is overdue or blocked, or a milestone is due with mandatory work open.",
  "At risk": "No critical blocker, but mandatory work is due within 7 days or waits on an open prerequisite.",
  "On track": "Mandatory work for the next milestone is open, but nothing is due within 7 days.",
  Ready: "Every mandatory task for the next milestone, including prerequisites, is completed.",
};

/** Solid accent colours for larger readiness indicators. */
export const READINESS_SOLID: Record<ReadinessStatus, string> = {
  "Not ready": "bg-red-600 text-white",
  "At risk": "bg-amber-500 text-white",
  "On track": "bg-sky-600 text-white",
  Ready: "bg-emerald-600 text-white",
};

export function ReadinessBadge({
  status,
  className,
  size = "sm",
}: {
  status: ReadinessStatus;
  className?: string;
  size?: "sm" | "md";
}) {
  const Icon = READINESS_ICON[status];
  return (
    <Badge
      tone={READINESS_TONE[status]}
      icon={<Icon aria-hidden />}
      className={cn(size === "md" && "px-2.5 py-1 text-sm [&_svg]:size-3.5", className)}
    >
      {status}
    </Badge>
  );
}
