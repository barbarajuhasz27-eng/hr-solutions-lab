import { cn } from "@/lib/cn";

/** A circular progress indicator with the percentage in the middle. */
export function ProgressRing({
  value,
  label,
  size = 88,
  stroke = 8,
  trackClassName = "stroke-white/15",
  barClassName = "stroke-accent-ring",
  textClassName = "fill-white",
}: {
  value: number;
  label: string;
  size?: number;
  stroke?: number;
  trackClassName?: string;
  barClassName?: string;
  textClassName?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`${label}: ${clamped}%`}
      className="shrink-0"
    >
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className={trackClassName} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - clamped / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className={cn("transition-[stroke-dashoffset] duration-700", barClassName)}
      />
      <text
        x="50%"
        y="50%"
        dominantBaseline="central"
        textAnchor="middle"
        className={cn("text-lg font-semibold tabular-nums", textClassName)}
      >
        {clamped}%
      </text>
    </svg>
  );
}
