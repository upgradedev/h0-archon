import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SiteNav } from "./components/SiteNav";
import { SiteNavAuth } from "./components/SiteNavAuth";
import "./globals.css";
import "./sota-ui.css";

export const metadata: Metadata = {
  title: "Archon on Vercel + AWS",
  description:
    "Agentic SMB finance intelligence for P&L, cash, sales, purchases, and payroll controls on Vercel with AWS persistence.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SiteNav authSlot={<SiteNavAuth />} />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
