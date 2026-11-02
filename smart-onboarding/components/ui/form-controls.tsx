import { ChevronDown, Search } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-lg border bg-surface text-sm text-ink shadow-sm transition-colors placeholder:text-muted/80 focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/25 disabled:bg-subtle";

export function TextInput({
  className,
  invalid,
  ...props
}: ComponentProps<"input"> & { invalid?: boolean }) {
  return (
    <input
      className={cn(
        control,
        "h-10 px-3",
        invalid ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-500/20" : "border-line-strong",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...props}
    />
  );
}

export function SelectInput({
  className,
  invalid,
  children,
  size = "md",
  ...props
}: Omit<ComponentProps<"select">, "size"> & { invalid?: boolean; size?: "sm" | "md" }) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(
          control,
          "appearance-none pr-9",
          size === "sm" ? "h-9 pl-3" : "h-10 pl-3",
          invalid ? "border-red-400" : "border-line-strong",
        )}
        aria-invalid={invalid || undefined}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted"
      />
    </div>
  );
}

export function SearchInput({ className, ...props }: ComponentProps<"input">) {
  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
      />
      <input type="search" className={cn(control, "h-9 border-line-strong pr-3 pl-9")} {...props} />
    </div>
  );
}

export function Field({
  id,
  label,
  hint,
  error,
  required,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-red-700" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
