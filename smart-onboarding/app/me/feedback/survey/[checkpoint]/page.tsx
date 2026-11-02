import type { Metadata } from "next";
import { SurveyView } from "@/components/feedback/survey-view";

export const metadata: Metadata = { title: "Pulse survey" };

export default async function SurveyPage({ params }: { params: Promise<{ checkpoint: string }> }) {
  const { checkpoint } = await params;
  return <SurveyView checkpoint={checkpoint} />;
}
