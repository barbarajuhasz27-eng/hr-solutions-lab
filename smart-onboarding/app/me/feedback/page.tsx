import type { Metadata } from "next";
import { PortalFeedbackView } from "@/components/feedback/portal-feedback-view";

export const metadata: Metadata = { title: "Feedback & check-ins" };

export default function FeedbackPage() {
  return <PortalFeedbackView />;
}
