import { AlertTriangle, CheckCircle2, Clock, Flag } from "lucide-react";
import { Badge, type Tone } from "@/components/ui/badge";
import type { MilestoneStatus } from "@/lib/metrics";

export const MILESTONE_TONE: Record<MilestoneStatus, Tone> = {
  Completed: "success",
  Overdue: "danger",
  "Due soon": "warning",
  Upcoming: "neutral",
};

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  const icon =
    status === "Completed" ? (
      <CheckCircle2 aria-hidden />
    ) : status === "Overdue" ? (
      <AlertTriangle aria-hidden />
    ) : status === "Due soon" ? (
      <Clock aria-hidden />
    ) : (
      <Flag aria-hidden />
    );
  return (
    <Badge tone={MILESTONE_TONE[status]} icon={icon}>
      {status}
    </Badge>
  );
}
