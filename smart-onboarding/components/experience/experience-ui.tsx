import { FlaskConical, Info } from "lucide-react";
import type { ReactNode } from "react";
import { ANALYTICS_DISCLAIMER } from "@/lib/experience";
import type { Rate } from "@/lib/learning";

/** The required notice, shown in every analytics section. */
export function AnalyticsNote() {
  return (
    <p className="flex gap-1.5 border-t border-line bg-subtle px-5 py-3 text-xs leading-relaxed text-muted">
      <FlaskConical aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>{ANALYTICS_DISCLAIMER}</span>
    </p>
  );
}

export function DefinitionNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex gap-1.5 px-5 pb-3 text-xs leading-relaxed text-muted">
      <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        <span className="font-semibold text-ink-soft">Definition: </span>
        {children}
      </span>
    </p>
  );
}

/** "85%", or "No data" when the denominator is zero. Never NaN or Infinity. */
export function formatRate(r: Rate): string {
  return r.percent === null ? "No data" : `${r.percent}%`;
}

/** "11 of 13 …", or the no-data explanation. */
export function rateHint(r: Rate, of: string, empty: string): string {
  return r.denominator === 0 ? empty : `${r.numerator} of ${r.denominator} ${of}`;
}
