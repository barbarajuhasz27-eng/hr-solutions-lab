"use client";

import { Building2, Sprout } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { areaForPath, areaForRole } from "@/lib/access";
import { demoModeActions, useDemoPreview } from "@/lib/use-demo-preview";

/**
 * Shows a notice instead of the page when it belongs to the other preview (for example an HR
 * page while previewing as a new hire). This only shapes the demo; it is not access control.
 */
export function PreviewGate({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const preview = useDemoPreview();
  const area = areaForPath(pathname);

  if (!preview || area === null || area === areaForRole(preview.role)) return <>{children}</>;

  const hrPage = area === "hr";
  return (
    <Card className="mx-auto max-w-xl p-6 text-center sm:p-8">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-accent-soft text-accent-strong [&_svg]:size-5">
        {hrPage ? <Building2 aria-hidden /> : <Sprout aria-hidden />}
      </span>
      <h1 className="mt-4 text-lg font-semibold text-ink">
        {hrPage ? "This page is part of the HR workspace" : "This page is part of the new-hire portal"}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {hrPage
          ? "You are previewing as a new hire. Switch to the HR preview to open this page."
          : "You are previewing as HR. Switch to the New Hire preview to open this page."}{" "}
        The previews are simulated for the demo. There is no sign-in and no real access control.
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button onClick={() => demoModeActions.setRole(hrPage ? "hr" : "new-hire")}>
          {hrPage ? "Switch to Preview as HR" : "Switch to Preview as New Hire"}
        </Button>
        <ButtonLink href="/" variant="secondary">
          {hrPage ? "Go to portal home" : "Go to HR dashboard"}
        </ButtonLink>
      </div>
    </Card>
  );
}
