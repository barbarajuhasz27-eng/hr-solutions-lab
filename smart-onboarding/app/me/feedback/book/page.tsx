import type { Metadata } from "next";
import { BookingView } from "@/components/feedback/booking-view";

export const metadata: Metadata = { title: "Book a check-in" };

export default function BookPage() {
  return <BookingView />;
}
