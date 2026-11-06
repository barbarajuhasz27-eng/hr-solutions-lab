import { RecoveryView } from "@/components/views/recovery-view";

export const metadata = { title: "Recovery mode" };

export default async function RecoveryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecoveryView id={decodeURIComponent(id)} />;
}
