"use client"

import { useEffect, useState } from "react"
import { Moon, Sun } from "lucide-react"

type Theme = "light" | "dark"

/**
 * Theme toggle. Reads the current theme from the <html> classList (set pre-paint
 * by the bootstrap script in app/layout.tsx), flips it on click, and persists to
 * localStorage. Renders a stable placeholder until mounted so the server and
 * first client render match (no hydration mismatch).
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light")
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light")
  }, [])

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    const root = document.documentElement
    root.classList.remove("light", "dark")
    root.classList.add(next)
    try {
      localStorage.setItem("archon-theme", next)
    } catch {
      // ignore storage failures (private mode, quota) — toggle still works in-session
    }
    setTheme(next)
  }

  const className =
    "grid size-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"

  if (!mounted) {
    // Placeholder keeps layout stable and avoids a hydration mismatch on the icon.
    return <span aria-hidden className={className} />
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={className}
    >
      {theme === "dark" ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </button>
  )
}
