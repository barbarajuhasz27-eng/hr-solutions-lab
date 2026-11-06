import { Ban, Check, Circle, CircleCheck, Clock3, Hourglass, TriangleAlert, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { getStatusLabel } from "@/lib/engine";
import { formatDuration, formatShortDate } from "@/lib/format";
import type { Activity, ActionInstance, ActivityStatus } from "@/lib/model";

// ---------------------------------------------------------------------------
// Formatting: every date, time and duration comes from lib/format.ts (§8.6, Europe/Vienna).
// ---------------------------------------------------------------------------

/** Short date "DD.MM." */
export { formatShortDate as formatDate } from "@/lib/format";
/** Full date "DD.MM.YYYY" */
export { formatDate as formatFullDate } from "@/lib/format";
export { formatLongDate, formatTime, formatWeekday } from "@/lib/format";

export function minutesToStart(startsAt: string, now: Date) {
  return (new Date(startsAt).getTime() - now.getTime()) / 60_000;
}

export function remainingLabel(startsAt: string, now: Date) {
  const minutes = minutesToStart(startsAt, now);
  return minutes > 0 ? `${formatDuration(minutes)} remaining` : `Started ${formatDuration(-minutes)} ago`;
}

export function dueLabel(action: ActionInstance, activity: Activity, now: Date) {
  const dueAt = new Date(new Date(activity.startsAt).getTime() + action.dueOffsetMinutes * 60_000);
  const delta = dueAt.getTime() - now.getTime();
  if (action.status === "done") return "Completed";
  if (delta < 0) {
    const minutes = Math.ceil(Math.abs(delta) / 60_000);
    if (minutes < 60) return `Overdue ${minutes}m`;
    const days = Math.floor(minutes / 1_440);
    if (days > 0) return `Overdue ${days}d`;
    return `Overdue ${Math.floor(minutes / 60)}h`;
  }
  if (delta < 60 * 60_000) return `Due in ${Math.ceil(delta / 60_000)}m`;
  if (delta < 24 * 60 * 60_000) return `Due in ${Math.floor(delta / 3_600_000)}h`;
  return `Due ${formatShortDate(dueAt)}`;
}

// ---------------------------------------------------------------------------
// State indicators: colour is never the only signal (8.1) — every state has an icon and a label.
// ---------------------------------------------------------------------------

const STATE_TONE: Record<ActivityStatus, "risk" | "due" | "ok" | "done" | "neutral" | "hot"> = {
  planned: "neutral",
  preparing: "neutral",
  "needs-attention": "due",
  "at-risk": "risk",
  recovery: "hot",
  ready: "ok",
  completed: "done",
  cancelled: "done",
};

function StateIcon({ status }: { status: ActivityStatus }) {
  const size = 13;
  switch (status) {
    case "recovery": return <Zap size={size} aria-hidden />;
    case "at-risk": return <TriangleAlert size={size} aria-hidden />;
    case "needs-attention": return <Clock3 size={size} aria-hidden />;
    case "ready": return <CircleCheck size={size} aria-hidden />;
    case "completed": return <Check size={size} aria-hidden />;
    case "cancelled": return <Ban size={size} aria-hidden />;
    default: return <Circle size={size} aria-hidden />;
  }
}

export function ReadinessState({ status }: { status: ActivityStatus }) {
  return (
    <span className={`state state-${STATE_TONE[status]}`} data-status={status}>
      <StateIcon status={status} />
      {getStatusLabel(status)}
    </span>
  );
}

export function CriticalityTag({ value }: { value: ActionInstance["criticality"] }) {
  return <span className={`tag tag-${value}`}>{value}</span>;
}

export function HoldBadge({ action }: { action: ActionInstance }) {
  if (action.status === "waiting") return <span className="state state-wait"><Hourglass size={12} aria-hidden /> Waiting</span>;
  if (action.status === "blocked") return <span className="state state-blocked"><Ban size={12} aria-hidden /> Blocked</span>;
  return null;
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <div className="label">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  icon,
  kicker,
  title,
  children,
  links,
}: {
  icon?: ReactNode;
  kicker?: string;
  title: string;
  children?: ReactNode;
  links?: { href: string; label: string; primary?: boolean }[];
}) {
  return (
    <section className="empty-state" aria-labelledby="empty-state-title">
      {icon && <div className="empty-icon">{icon}</div>}
      {kicker && <div className="label">{kicker}</div>}
      <h2 id="empty-state-title" className="empty-title">{title}</h2>
      {children && <div className="empty-copy">{children}</div>}
      {links && links.length > 0 && (
        <div className="empty-links">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className={`btn ${link.primary ? "btn-primary" : "btn-outline"}`}>
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export function LoadingState({ label = "Preparing your operations workspace…" }: { label?: string }) {
  return (
    <div className="loading-state" role="status">
      <span className="loading-mark" aria-hidden>OH</span>
      <span>{label}</span>
    </div>
  );
}
