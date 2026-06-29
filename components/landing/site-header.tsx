"use client"

import { useEffect, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const NAV = [
  { label: "Platform", href: "#modules" },
  { label: "How it works", href: "#engine" },
  { label: "Stack", href: "#stack" },
]

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled
          ? "border-b border-border/70 bg-background/80 backdrop-blur-md"
          : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <a href="#" className="flex items-center gap-2" aria-label="Archon home">
          <span className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground">
            <span className="text-sm font-semibold">A</span>
          </span>
          <span className="text-lg font-semibold tracking-tight">Archon</span>
        </a>

        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <a
            href="/api/auth/signin"
            className="hidden text-sm text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            Sign in
          </a>
          <a
            href="/dashboard"
            className={cn(buttonVariants({ size: "lg" }), "rounded-full px-4")}
          >
            Open the dashboard
          </a>
        </div>
      </div>
    </header>
  )
}
