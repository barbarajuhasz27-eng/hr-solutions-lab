import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { TodayRoute } from "@/components/views/today-route";

export const metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TodayRoute />
    </Suspense>
  );
}
