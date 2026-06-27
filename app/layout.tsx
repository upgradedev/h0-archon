import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Archon on Vercel + AWS",
  description:
    "Agentic financial intelligence for SMB payroll reconciliation, deployed on Vercel with AWS Aurora persistence.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
