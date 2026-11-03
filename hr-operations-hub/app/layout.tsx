import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HR Operations Hub · Readiness & Playbooks",
    template: "%s · HR Operations Hub",
  },
  description:
    "A focused HR Operations workspace for preparing and recovering operational activities. Synthetic portfolio data only.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f5f4f0",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
