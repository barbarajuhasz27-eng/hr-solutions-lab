import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatShortDate } from "@/lib/dates";
import type { JourneyPhase, PhaseState } from "@/lib/portal";

export const PHASE_STATE_LABEL: Record<PhaseState, string> = {
  done: "Done",
  current: "You are here",
  "wrapping-up": "Finishing up",
  upcoming: "Coming up",
};

export function phaseAnchor(phase: Pick<JourneyPhase, "stage">): string {
  return `phase-${phase.stage.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function phaseDates(phase: JourneyPhase): string {
  if (phase.fromDay === phase.toDay) return formatShortDate(phase.startDate);
  if (phase.fromDay < 0) return `Until ${formatShortDate(phase.endDate)}`;
  return `${formatShortDate(phase.startDate)} – ${formatShortDate(phase.endDate)}`;
}

/** The five phases of the first 90 days, with the employee's current position highlighted. */
export function JourneyStrip({ phases }: { phases: JourneyPhase[] }) {
  return (
    <nav aria-label="Your onboarding journey" className="rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5">
      <ol className="grid gap-3 md:grid-cols-5 md:gap-0">
        {phases.map((phase, index) => {
          const current = phase.state === "current";
          return (
            <li key={phase.stage} className="relative md:px-1">
              {index < phases.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-[calc(1.5rem-1px)] left-[calc(50%+1.25rem)] hidden h-0.5 w-[calc(100%-2.5rem)] rounded md:block",
                    phase.state === "done" ? "bg-emerald-300" : "bg-line",
                  )}
                />
              ) : null}
              <Link
                href={`/me/journey#${phaseAnchor(phase)}`}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-subtle md:flex-col md:items-center md:gap-2 md:text-center",
                  current && "bg-accent-soft/60 hover:bg-accent-soft",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ring-4 ring-surface",
                    phase.state === "done" && "bg-emerald-600 text-white",
                    current && "bg-accent text-white shadow-[0_0_0_4px_var(--color-accent-ring)]",
                    phase.state === "wrapping-up" && "bg-amber-100 text-amber-900",
                    phase.state === "upcoming" && "bg-subtle text-muted ring-line",
                  )}
                >
                  {phase.state === "done" ? <Check className="size-4" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{phase.label}</span>
                  <span className="block text-xs text-muted">{phaseDates(phase)}</span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs font-medium",
                      current ? "text-accent-strong" : phase.state === "wrapping-up" ? "text-amber-800" : "text-muted",
                    )}
                  >
                    {PHASE_STATE_LABEL[phase.state]}
                    {phase.total > 0 ? ` · ${phase.done}/${phase.total} steps` : ""}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
