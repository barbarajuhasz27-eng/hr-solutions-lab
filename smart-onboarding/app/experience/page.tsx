import type { Metadata } from "next";
import { ExperienceView } from "@/components/experience/experience-view";

export const metadata: Metadata = { title: "Experience & Process Intelligence" };

export default function ExperiencePage() {
  return <ExperienceView />;
}
