import type { Metadata } from "next";
import { ReadinessView } from "@/components/readiness/readiness-view";

export const metadata: Metadata = { title: "Readiness & risk" };

export default async function ReadinessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { status } = await searchParams;
  return <ReadinessView initialStatus={typeof status === "string" ? status : undefined} />;
}
