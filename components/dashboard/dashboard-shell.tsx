"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { useDashboardData } from "./data-context"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Scale,
  Waves,
  Target,
  Boxes,
  Repeat,
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
  { id: "pnl", label: "P&L", icon: Scale },
  { id: "cash", label: "Cash flow", icon: Waves },
  { id: "sales", label: "Sales", icon: Target },
  { id: "purchases", label: "Purchases", icon: Boxes },
  { id: "capital", label: "Working capital", icon: Repeat },
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
                  <span className="hidden items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary sm:inline-flex">
                    <span className="size-1.5 rounded-full bg-primary" /> Live
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
              <div className="hidden items-center rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground sm:flex">
                {period}
              </div>
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
