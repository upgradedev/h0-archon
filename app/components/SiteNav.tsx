"use client";

// Shared top navigation across the marketing landing, the finance-close
// dashboard, and the live-extract demo. Replaces the dashboard's dark left
// sidebar as the primary cross-page nav (the sidebar stays as in-page context).

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/extract", label: "Live Extract" },
];

export function SiteNav({ authSlot }: { authSlot?: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="site-nav">
      <Link href="/" className="site-nav-brand" aria-label="Archon home">
        <span className="site-nav-mark">A</span>
        <span className="site-nav-name">Archon</span>
        <span className="site-nav-sub">Vercel + AWS</span>
      </Link>
      <nav className="site-nav-links" aria-label="Primary">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`site-nav-link${isActive(l.href) ? " active" : ""}`}
            aria-current={isActive(l.href) ? "page" : undefined}
          >
            {l.label}
          </Link>
        ))}
        <a
          className="site-nav-cta"
          href="https://github.com/upgradedev/h0-archon"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        {authSlot}
      </nav>
    </header>
  );
}
