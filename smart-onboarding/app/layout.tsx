import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Smart Onboarding · Employee Experience & HR Process Intelligence",
    template: "%s · Smart Onboarding",
  },
  description:
    "A portfolio prototype of a connected onboarding platform: an employee portal and an HR workspace across the first 90 days. Synthetic demo data only.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f4ef",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
