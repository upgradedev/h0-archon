import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Archon — Agentic financial intelligence for SMBs",
  description:
    "Archon fuses every financial document your business receives — sales, purchases, bank statements and payroll — into one boardroom-ready monthly close. AI reads your books; a deterministic engine computes them. Built on Vercel + AWS.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#0b3b2e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`light ${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
