import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import type { ReactNode } from "react";
import { HubStoreProvider } from "@/components/hub-store";
import { THEME_INIT_SCRIPT } from "@/components/theme";
import "./globals.css";

// next/font downloads the files at build time and serves them from this app: no runtime requests to Google.
const plexSans = IBM_Plex_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-plex-sans", display: "swap" });
const plexCondensed = IBM_Plex_Sans_Condensed({ subsets: ["latin", "latin-ext"], weight: ["600", "700"], variable: "--font-plex-condensed", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "HR Operations Hub",
    template: "%s · HR Operations Hub",
  },
  description:
    "An HR Operations Management workspace for lean HR teams: readiness, playbooks and recovery. Synthetic demo data only.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F7F9" },
    { media: "(prefers-color-scheme: dark)", color: "#12161C" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className={`${plexSans.variable} ${plexCondensed.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <HubStoreProvider>{children}</HubStoreProvider>
      </body>
    </html>
  );
}
