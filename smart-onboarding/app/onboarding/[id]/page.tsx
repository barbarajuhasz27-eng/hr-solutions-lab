import type { Metadata } from "next";
import { CaseDetailView } from "@/components/onboarding/case-detail-view";

export const metadata: Metadata = { title: "Onboarding case" };

export default async function OnboardingCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CaseDetailView id={decodeURIComponent(id)} />;
}
