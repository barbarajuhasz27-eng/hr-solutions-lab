"use client";

import { ChevronDown, FlaskConical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId } from "react";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { PREVIEW_ROLES, type PreviewRole } from "@/lib/access";
import { resolvePreviewCase } from "@/lib/demo-mode";
import { demoModeActions, useDemoPreview } from "@/lib/use-demo-preview";
import { useOnboarding } from "@/lib/use-onboarding";

const ROLE_OPTION_LABEL: Record<PreviewRole, string> = {
  "new-hire": "Preview as New Hire",
  hr: "Preview as HR",
};

/**
 * The Demo Mode bar shown above every page. It makes clear that the two previews are
 * simulated, and lets the viewer switch between them and pick which new hire to preview.
 */
export function DemoModeBar() {
  return (
    <div className="border-b border-ink bg-ink text-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-2.5 px-4 py-2.5 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <p className="flex items-start gap-2 text-xs leading-relaxed text-white/85">
          <span className="mt-px inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-ink uppercase">
            <FlaskConical aria-hidden className="size-3" />
            Demo mode
          </span>
          <span>
            <strong className="font-semibold text-white">Demonstration prototype</strong> with synthetic data only.
            Previews are simulated: there is no sign-in and no real access control.
          </span>
        </p>
        <DemoModeSwitch />
      </div>
    </div>
  );
}

export function DemoModeSwitch() {
  const preview = useDemoPreview();
  const onboarding = useOnboarding();
  const router = useRouter();
  const { notify } = useToast();
  const personaId = useId();

  if (!preview) {
    return <div aria-hidden className="h-9 w-full max-w-md rounded-lg bg-white/10 md:w-[26rem]" />;
  }

  const switchRole = (role: PreviewRole) => {
    if (role === preview.role) return;
    demoModeActions.setRole(role);
    notify(
      role === "hr"
        ? "Now previewing the HR workspace. This is a simulated view, not a sign-in."
        : "Now previewing the new-hire portal. This is a simulated view, not a sign-in.",
    );
    router.push("/");
  };

  const persona =
    preview.role === "new-hire" && onboarding.hydrated
      ? resolvePreviewCase(onboarding.cases, preview.caseId, onboarding.today)
      : null;

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <fieldset className="flex rounded-lg bg-white/10 p-0.5">
        <legend className="sr-only">Demo mode: choose a simulated preview</legend>
        {PREVIEW_ROLES.map((role) => (
          <label
            key={role}
            className={cn(
              "relative flex-1 cursor-pointer rounded-md px-3 py-1.5 text-center text-xs font-semibold whitespace-nowrap transition-colors sm:flex-none",
              "text-white/80 hover:text-white",
              "has-[:checked]:bg-white has-[:checked]:text-ink has-[:checked]:shadow-sm",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ring",
            )}
          >
            <input
              type="radio"
              name="demo-preview-role"
              value={role}
              checked={preview.role === role}
              onChange={() => switchRole(role)}
              className="sr-only"
            />
            {ROLE_OPTION_LABEL[role]}
          </label>
        ))}
      </fieldset>

      {preview.role === "new-hire" && onboarding.hydrated && onboarding.cases.length > 0 ? (
        <div className="flex items-center gap-2">
          <label htmlFor={personaId} className="text-xs whitespace-nowrap text-white/75">
            Viewing as
          </label>
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <select
              id={personaId}
              value={persona?.id ?? ""}
              onChange={(event) => demoModeActions.previewCase(event.target.value)}
              className="h-8 w-full appearance-none rounded-md border border-white/20 bg-white/10 pr-8 pl-2.5 text-xs font-medium text-white focus:outline-none focus-visible:border-accent-ring focus-visible:ring-2 focus-visible:ring-accent-ring/40 sm:w-48 [&>option]:text-ink"
            >
              {onboarding.cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.employeeName}
                </option>
              ))}
            </select>
            <ChevronDown
              aria-hidden
              className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-white/70"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
