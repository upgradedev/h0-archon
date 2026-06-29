"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { formatEUR } from "@/lib/format"
import { cn } from "@/lib/utils"
import type { Account } from "@/lib/demo-ledger"
import { Pill } from "./primitives"
import { useMounted } from "./use-mounted"

export type DetailRow = { label: string; value: string }

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  account,
  rows,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  account?: Account
  rows?: DetailRow[]
}) {
  const mounted = useMounted()

  // Close on Escape while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Portal to <body> so the fixed-position drawer is anchored to the viewport.
  // (Panel's `animate-rise` leaves a residual `transform` on its <section>, which
  // would otherwise become the containing block for a `fixed` descendant.)
  if (!mounted) return null

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      )}
      aria-hidden={!open}
    >
      {/* backdrop */}
      <div
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-foreground/30 backdrop-blur-[1px] transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-border bg-card shadow-xl transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-border/70 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</h2>
            {subtitle ? (
              <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-7 shrink-0 place-items-center rounded-md text-base leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <span aria-hidden>&times;</span>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {account ? <AccountLedger account={account} /> : null}
          {!account && rows ? (
            <dl className="space-y-2.5">
              {rows.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5"
                >
                  <dt className="text-xs text-muted-foreground">{r.label}</dt>
                  <dd className="text-sm font-semibold tabular-nums text-foreground">{r.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  )
}

function AccountLedger({ account }: { account: Account }) {
  let running = 0
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-lg border border-border/70">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/70 bg-muted/40 text-left text-[11px] text-muted-foreground">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Description</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
              <th className="px-3 py-2 text-right font-medium">Balance</th>
              <th className="px-3 py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {account.invoices.map((inv) => {
              running += inv.amount
              return (
                <tr key={inv.id} className="border-b border-border/50 last:border-0">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-muted-foreground">
                    {inv.date}
                  </td>
                  <td className="px-3 py-2 text-foreground">{inv.description}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                    {formatEUR(inv.amount)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {formatEUR(running)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Pill
                      tone={inv.status === "paid" ? "positive" : "warning"}
                      className="capitalize"
                    >
                      {inv.status}
                    </Pill>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
        <span className="text-xs text-muted-foreground">Total invoiced</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {formatEUR(account.total)}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--warning)]/25 bg-[var(--warning)]/10 px-3 py-2.5">
        <span className="text-xs text-[var(--warning)]">Open balance</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--warning)]">
          {formatEUR(account.openBalance)}
        </span>
      </div>
    </div>
  )
}
