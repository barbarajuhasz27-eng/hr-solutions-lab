"use client";

import { DashboardView } from "@/components/dashboard/dashboard-view";
import { PortalHomeView, PortalSkeleton } from "@/components/portal/portal-home-view";
import { useDemoPreview } from "@/lib/use-demo-preview";

/** "/" shows the employee portal home or the HR dashboard, depending on the Demo Mode preview. */
export function HomeView() {
  const preview = useDemoPreview();
  if (!preview) return <PortalSkeleton />;
  return preview.role === "hr" ? <DashboardView /> : <PortalHomeView />;
}
