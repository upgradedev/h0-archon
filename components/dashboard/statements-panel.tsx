"use client"

import { useMemo, useState } from "react"
import { formatEUR } from "@/lib/format"
import { cn } from "@/lib/utils"
import { buildLedger, type Account } from "@/lib/demo-ledger"
import { useDashboardData } from "./data-context"
import { Panel, Pill } from "./primitives"
import { DetailDrawer } from "./detail-drawer"
import { FileText, ChevronRight } from "lucide-react"

type Tab = "customers" | "suppliers"

export function StatementsPanel() {
  const vm = useDashboardData()
  const ledger = useMemo(() => buildLedger(vm), [vm])
  const [tab, setTab] = useState<Tab>("customers")
  const [selected, setSelected] = useState<Account | null>(null)

  const isCustomers = tab === "customers"
  const accounts = isCustomers ? ledger.customers : ledger.suppliers
  const total = isCustomers ? ledger.arTotal : ledger.apTotal
  const open = isCustomers ? ledger.arOpen : ledger.apOpen
  const totalLabel = isCustomers ? "AR" : "AP"

  return (
    <Panel
      title="Account statements"
      subtitle="Customer & supplier ledgers, reconciled to the close"
      icon={<FileText className="size-4" />}
      action={
        <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
          {(["customers", "suppliers"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium capitalize transition-colors",
                tab === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">
          {totalLabel} <span className="font-semibold tabular-nums text-foreground">{formatEUR(total)}</span>
        </span>
        <Pill tone="warning">open {formatEUR(open)}</Pill>
      </div>

      <div className="space-y-1.5">
        {accounts.map((acc) => (
          <button
            key={acc.name}
            onClick={() => setSelected(acc)}
            className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border/70 hover:bg-muted"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{acc.name}</div>
              <div className="text-[11px] text-muted-foreground">
                {acc.invoices.length} invoice{acc.invoices.length === 1 ? "" : "s"} · {acc.paidCount} paid
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold tabular-nums text-foreground">
                {formatEUR(acc.total)}
              </div>
              <div className="text-[11px] tabular-nums text-[var(--warning)]">
                {acc.openBalance > 0 ? `${formatEUR(acc.openBalance)} open` : "settled"}
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground" />
          </button>
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Derived from the period&rsquo;s posted invoices — totals reconcile to revenue / COGS; open
        items to receivables / payables.
      </p>

      <DetailDrawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name ?? ""}
        subtitle={
          selected
            ? `${selected.kind === "customer" ? "Customer" : "Supplier"} statement · ${selected.invoices.length} invoices`
            : undefined
        }
        account={selected ?? undefined}
      />
    </Panel>
  )
}
