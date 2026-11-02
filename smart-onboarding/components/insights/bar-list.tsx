"use client";

import { Table2 } from "lucide-react";
import { useId, useState } from "react";
import { cn } from "@/lib/cn";

export type BarRow = {
  key: string;
  label: string;
  value: number;
  /** Text printed at the bar tip, e.g. "67%" or "4". */
  display: string;
  /** Secondary text shown under the label and in the tooltip. */
  detail?: string;
};

/**
 * Single-series horizontal bars (one hue, value at the tip) with a hover/focus tooltip
 * and a table view. Values are always printed, so colour is never the only carrier.
 */
export function BarList({
  rows,
  max,
  caption,
  valueHeader,
  emptyText = "No data yet.",
}: {
  rows: BarRow[];
  /** Scale maximum; defaults to the largest value. */
  max?: number;
  caption: string;
  valueHeader: string;
  emptyText?: string;
}) {
  const [asTable, setAsTable] = useState(false);
  const tableId = useId();
  const scale = max ?? Math.max(1, ...rows.map((r) => r.value));

  if (rows.length === 0) return <p className="px-5 py-6 text-sm text-muted">{emptyText}</p>;

  return (
    <div className="px-5 py-4">
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          aria-pressed={asTable}
          aria-controls={tableId}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-muted hover:bg-ink/5 hover:text-ink"
        >
          <Table2 aria-hidden className="size-3.5" />
          {asTable ? "Show chart" : "Show table"}
        </button>
      </div>
      {asTable ? (
        <table id={tableId} className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="text-xs text-muted">
            <tr className="border-b border-line">
              <th scope="col" className="py-1.5 font-medium">Item</th>
              <th scope="col" className="py-1.5 text-right font-medium">{valueHeader}</th>
              <th scope="col" className="py-1.5 pl-4 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="py-1.5 font-normal text-ink">{r.label}</th>
                <td className="py-1.5 text-right font-medium tabular-nums">{r.display}</td>
                <td className="py-1.5 pl-4 text-xs text-muted">{r.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul id={tableId} aria-label={caption} className="space-y-3">
          {rows.map((r) => {
            const pct = scale === 0 ? 0 : (r.value / scale) * 100;
            return (
              <li
                key={r.key}
                tabIndex={0}
                aria-label={`${r.label}: ${r.display}${r.detail ? `. ${r.detail}` : ""}`}
                className="group relative rounded-md outline-offset-4 focus-visible:outline-2"
              >
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="truncate text-ink-soft">{r.label}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {/* Bar track hit area is the full row; bar grows from the left baseline. */}
                  <div className="h-2.5 flex-1">
                    <div
                      className={cn(
                        "h-full rounded-r bg-accent transition-[width] duration-500 group-hover:bg-accent-strong",
                        r.value === 0 && "w-0",
                      )}
                      style={{ width: `${pct}%`, minWidth: r.value > 0 ? 3 : 0 }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm font-medium text-ink tabular-nums">
                    {r.display}
                  </span>
                </div>
                {r.detail ? <p className="mt-0.5 text-xs text-muted">{r.detail}</p> : null}
                <span
                  role="tooltip"
                  className="pointer-events-none absolute -top-2 right-14 z-10 hidden -translate-y-full rounded-md bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-raised group-hover:block group-focus-visible:block"
                >
                  <span className="font-semibold">{r.label}</span> · {r.display}
                  {r.detail ? <span className="block text-white/75">{r.detail}</span> : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
