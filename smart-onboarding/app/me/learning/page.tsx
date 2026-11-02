import type { Metadata } from "next";
import { LearningCatalogView } from "@/components/learning/learning-catalog-view";

export const metadata: Metadata = { title: "Learning Center" };

export default function LearningCenterPage() {
  return <LearningCatalogView />;
}
