import { OccurrenceView } from "@/components/views/occurrence-view";

export const metadata = { title: "Occurrence" };

export default async function OccurrencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OccurrenceView id={decodeURIComponent(id)} />;
}
