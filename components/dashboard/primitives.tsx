import type * as React from "react"
import { cn } from "@/lib/utils"

export function Panel({
  title,
  subtitle,
  icon,
  action,
  className,
  bodyClassName,
  children,
  style,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  action?: React.ReactNode
  className?: string
  bodyClassName?: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <section
      style={style}
      className={cn(
        "animate-rise flex flex-col rounded-xl border border-border bg-card",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? (
            <span className="grid size-7 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className={cn("flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  )
}

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "positive" | "warning" | "danger" | "info"
  children: React.ReactNode
  className?: string
}) {
  const tones: Record<string, string> = {
    neutral: "bg-muted text-muted-foreground border-border",
    positive: "bg-primary/12 text-primary border-primary/25",
    warning: "bg-[var(--warning)]/12 text-[var(--warning)] border-[var(--warning)]/25",
    danger: "bg-destructive/12 text-destructive border-destructive/25",
    info: "bg-[var(--chart-2)]/12 text-[var(--chart-2)] border-[var(--chart-2)]/25",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

export function Delta({ value }: { value: number }) {
  // No prior-period data: a zero delta renders nothing rather than a fake trend.
  if (value === 0) return null
  const up = value >= 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
        up ? "text-primary" : "text-destructive",
      )}
    >
      {up ? "▲" : "▼"} {Math.abs(value).toFixed(1)}%
    </span>
  )
}
