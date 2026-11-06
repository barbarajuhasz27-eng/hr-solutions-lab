"use client";

import { useSearchParams } from "next/navigation";
import { FILTER_PARAM, parseExceptionFilter } from "@/lib/shell";
import { TodayView } from "./today-view";

/** Reads the exception filter from the URL (`/?show=overdue`). */
export function TodayRoute() {
  const params = useSearchParams();
  return <TodayView filter={parseExceptionFilter(params.get(FILTER_PARAM))} />;
}
