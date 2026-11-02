import type { Metadata } from "next";
import { HrCheckInsView } from "@/components/feedback/hr-check-ins-view";

export const metadata: Metadata = { title: "Feedback & check-ins" };

export default function CheckInsPage() {
  return <HrCheckInsView />;
}
