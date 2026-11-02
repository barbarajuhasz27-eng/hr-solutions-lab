"use client";

import type { Viewer } from "@/lib/access";
import { resolvePreviewCase } from "@/lib/demo-mode";
import { useDemoPreview } from "@/lib/use-demo-preview";
import { useOnboarding } from "@/lib/use-onboarding";
import type { ISODate, OnboardingCase } from "@/types/onboarding";

export type PortalCaseState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "ready"; onboarding: OnboardingCase; today: ISODate; viewer: Viewer };

/** The case shown in the New Hire preview, plus the simulated viewer used for access rules. */
export function usePortalCase(): PortalCaseState {
  const data = useOnboarding();
  const preview = useDemoPreview();
  if (!data.hydrated || !preview) return { status: "loading" };
  const onboarding = resolvePreviewCase(data.cases, preview.caseId, data.today);
  if (!onboarding) return { status: "empty" };
  return {
    status: "ready",
    onboarding,
    today: data.today,
    viewer: { role: "new-hire", caseId: onboarding.id },
  };
}
