import { Suspense } from "react";
import { LoadingState } from "@/components/ui";
import { TodayRoute } from "@/components/views/today-route";

export default function TodayPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <TodayRoute />
    </Suspense>
  );
}
