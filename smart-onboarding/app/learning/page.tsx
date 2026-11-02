import type { Metadata } from "next";
import { HrLearningView } from "@/components/learning/hr-learning-view";

export const metadata: Metadata = { title: "Learning" };

export default function LearningPage() {
  return <HrLearningView />;
}
