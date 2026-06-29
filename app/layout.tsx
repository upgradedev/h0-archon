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

// Blocking, pre-paint theme bootstrap. Reads the persisted choice (default
// "light") and applies the class to <html> before first paint so there is no
// flash of the wrong theme. The added class also neutralizes the
// prefers-color-scheme media override in globals.css.
const themeScript = `(function(){try{var t=localStorage.getItem('archon-theme')||'light';document.documentElement.classList.add(t==='dark'?'dark':'light');}catch(e){document.documentElement.classList.add('light');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} bg-background`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
