import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type MetricTone = "neutral" | "accent" | "danger" | "success";

const iconTone: Record<MetricTone, string> = {
  neutral: "bg-slate-100 text-slate-700",
  accent: "bg-accent-soft text-accent",
  danger: "bg-red-50 text-red-700",
  success: "bg-emerald-50 text-emerald-700",
};

export function MetricCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon: ReactNode;
  tone?: MetricTone;
  children?: ReactNode;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg [&_svg]:size-4",
            iconTone[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 text-3xl font-semibold tracking-tight tabular-nums",
          tone === "danger" ? "text-red-700" : "text-ink",
        )}
      >
        {value}
      </p>
      {children}
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
