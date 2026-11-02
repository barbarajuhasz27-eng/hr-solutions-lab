import type { Metadata } from "next";
import { PortalJourneyView } from "@/components/portal/portal-journey-view";

export const metadata: Metadata = { title: "My journey" };

export default function JourneyPage() {
  return <PortalJourneyView />;
}
