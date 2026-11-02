import type { Metadata } from "next";
import { PortalMeetingView } from "@/components/feedback/meeting-record";

export const metadata: Metadata = { title: "Check-in" };

export default async function PortalMeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  return <PortalMeetingView meetingId={meetingId} />;
}
