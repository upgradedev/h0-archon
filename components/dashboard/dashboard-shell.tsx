"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ThemeToggle } from "@/components/theme-toggle"
import { useDashboardData } from "./data-context"
import { PeriodSelector } from "./period-selector"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  TrendingUp,
  Scale,
  Waves,
  Target,
  Boxes,
  Repeat,
  FileText,
  ShieldAlert,
  Bot,
  Sparkles,
  Play,
  Check,
  Loader2,
  ChevronRight,
} from "lucide-react"

const nav = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "trends", label: "Trends", icon: TrendingUp },
  { id: "pnl", label: "P&L", icon: Scale },
  { id: "cash", label: "Cash flow", icon: Waves },
  { id: "sales", label: "Sales", icon: Target },
  { id: "purchases", label: "Purchases", icon: Boxes },
  { id: "capital", label: "Working capital", icon: Repeat },
  { id: "statements", label: "Statements", icon: FileText },
  { id: "payroll", label: "Payroll", icon: ShieldAlert },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "ask", label: "Ask Archon", icon: Sparkles },
]

function ArchonMark() {
  return (
    <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
      <svg viewBox="0 0 24 24" className="size-4" fill="none" aria-hidden="true">
        <path d="M12 3 4 20h4l4-9 4 9h4L12 3Z" fill="currentColor" />
      </svg>
    </span>
  )
}

type CloseState = "idle" | "running" | "done"

export function DashboardShell({
  children,
  authSlot,
}: {
  children: React.ReactNode
  authSlot?: React.ReactNode
}) {
  const { entity, period } = useDashboardData()
  const router = useRouter()
  const [active, setActive] = useState("overview")
  const [closeState, setCloseState] = useState<CloseState>("idle")
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (closeState !== "running") return
    setProgress(0)
    const start = performance.now()
    let raf: number
    const tick = (now: number) => {
      const p = Math.min((now - start) / 2600, 1)
      setProgress(p * 100)
      if (p < 1) raf = requestAnimationFrame(tick)
      else setCloseState("done")
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [closeState])

  // When the close animation completes, re-pull the live report so any new
  // server-side data is reflected. router.refresh() is a no-op on failure.
  useEffect(() => {
    if (closeState === "done") {
      try {
        router.refresh()
      } catch {
        // never let a refresh failure break the dashboard
      }
    }
  }, [closeState, router])

  function goTo(id: string) {
    setActive(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  return (
    <div className="min-h-screen bg-background">
      {/* top progress bar for close run */}
      {closeState === "running" && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent">
          <div
            className="h-full bg-primary transition-[width] duration-150 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="mx-auto flex max-w-[1600px]">
        {/* slim left rail */}
        <aside className="sticky top-0 hidden h-screen w-16 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-4 md:flex">
          <div className="mb-3">
            <ArchonMark />
          </div>
          {nav.map((item) => {
            const Icon = item.icon
            const isActive = active === item.id
            return (
              <button
                key={item.id}
                onClick={() => goTo(item.id)}
                title={item.label}
                aria-label={item.label}
                className={cn(
                  "group relative grid size-10 place-items-center rounded-lg transition-colors",
                  isActive
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {isActive && (
                  <span className="absolute left-0 h-5 w-0.5 rounded-full bg-primary" />
                )}
                <Icon className="size-[18px]" />
              </button>
            )
          })}
        </aside>

        {/* main column */}
        <div className="min-w-0 flex-1">
          {/* top bar */}
          <header className="sticky top-0 z-40 flex flex-col gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:flex-row md:items-center md:justify-between md:px-6">
            <div className="flex items-center gap-3">
              <span className="md:hidden">
                <ArchonMark />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold tracking-tight text-foreground">
                    Finance command center
                  </h1>
                  <span
                    title="May 2026 is the live extracted payroll close; Jan–Apr are illustrative trends and the customer/supplier ledger is sample data."
                    className="hidden cursor-help items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground sm:inline-flex"
                  >
                    <span className="size-1.5 rounded-full bg-primary" /> Demo data
                  </span>
                </div>
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {entity}
                  <ChevronRight className="size-3" />
                  {period}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              <PeriodSelector />
              <Button
                variant={closeState === "done" ? "outline" : "default"}
                size="lg"
                onClick={() => setCloseState(closeState === "running" ? "running" : "running")}
                disabled={closeState === "running"}
              >
                {closeState === "running" ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Running close…
                  </>
                ) : closeState === "done" ? (
                  <>
                    <Check className="size-4 text-primary" /> Close complete
                  </>
                ) : (
                  <>
                    <Play className="size-4" /> Run finance close
                  </>
                )}
              </Button>
              {authSlot ? <div className="flex items-center">{authSlot}</div> : null}
            </div>
          </header>

          <main className="space-y-3 p-4 md:space-y-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
