import type { Metadata } from "next";
import { NewOnboardingForm } from "@/components/onboarding/new-onboarding-form";

export const metadata: Metadata = { title: "New onboarding" };

export default function NewOnboardingPage() {
  return <NewOnboardingForm />;
}
