import type { Metadata } from "next";
import { HrMeetingView } from "@/components/feedback/meeting-record";

export const metadata: Metadata = { title: "Meeting record" };

export default async function HrMeetingPage({ params }: { params: Promise<{ meetingId: string }> }) {
  const { meetingId } = await params;
  return <HrMeetingView meetingId={meetingId} />;
}
