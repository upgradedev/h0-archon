"use client"

import { useEffect, useRef, useState } from "react"
import { track } from "@vercel/analytics"
import { Search, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

// Result shape returned by /api/search (mirrors lib/search-model SearchHit).
type Hit = {
  id: string
  type: string
  title: string
  subtitle: string
  snippet: string
  amount?: number
  period?: string
}

type SearchResponse = {
  query: string
  total: number
  hits: Hit[]
  error?: string
}

// Display order + labels for the grouped result list. Documents lead: the panel is
// framed around "find your uploaded documents" first, counterparties and people next.
const GROUPS: { type: string; label: string }[] = [
  { type: "document", label: "Documents" },
  { type: "report", label: "Reports" },
  { type: "counterparty", label: "Counterparties" },
  { type: "employee", label: "Employees" },
  { type: "activity", label: "Activity" },
]

const eur = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 0,
})

function formatAmount(amount?: number): string | null {
  return typeof amount === "number" ? eur.format(amount) : null
}

// Search across every financial document & counterparty. Calls /api/search
// (debounced) and renders results grouped by type in a popover. The canonical
// figures on the dashboard come from the deterministic engine; this is the
// OpenSearch read-model (CQRS) for search/exploration only.
export function SearchPanel() {
  const [q, setQ] = useState("")
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SearchResponse | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  // Debounced fetch.
  useEffect(() => {
    const term = q.trim()
    if (!term) {
      setData(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`)
        const json = (await res.json()) as SearchResponse
        setData(json)
        // Analytics: a search returned results. No PII — the query term is
        // deliberately NOT included, only the hit count bucket.
        track("opened_search", { hits: json.total })
      } catch {
        setData({ query: term, total: 0, hits: [], error: "Search is unavailable right now." })
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(handle)
  }, [q])

  // Close on outside click.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  const hits = data?.hits ?? []
  const grouped = GROUPS.map((group) => ({
    ...group,
    hits: hits.filter((hit) => hit.type === group.type),
  })).filter((group) => group.hits.length > 0)

  const showPanel = open && q.trim().length > 0

  return (
    <div ref={boxRef} className="relative">
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
        )}
      >
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          value={q}
          onChange={(event) => {
            setQ(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search your uploaded documents, vendors & people…"
          aria-label="Search your uploaded documents, vendors and people"
          className="w-40 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground md:w-56"
        />
        {loading ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
        ) : q ? (
          <button
            type="button"
            onClick={() => {
              setQ("")
              setData(null)
            }}
            aria-label="Clear search"
            className="grid size-4 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {showPanel && (
        <div className="absolute right-0 z-50 mt-2 w-[min(92vw,420px)] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
          <div className="border-b border-border bg-muted/40 px-3 py-1.5">
            <p className="text-[10px] leading-tight text-muted-foreground">
              Find any uploaded document, counterparty or transaction — powered by an OpenSearch
              read-model (CQRS).
            </p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2">
            {data?.error ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">{data.error}</p>
            ) : grouped.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                {loading ? "Searching…" : `No matches for “${q.trim()}”.`}
              </p>
            ) : (
              grouped.map((group) => (
                <div key={group.type} className="mb-1.5 last:mb-0">
                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </p>
                  <ul>
                    {group.hits.map((hit) => {
                      const amount = formatAmount(hit.amount)
                      return (
                        <li
                          key={hit.id}
                          className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-muted"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{hit.title}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {hit.subtitle}
                              {hit.snippet ? ` · ${hit.snippet}` : ""}
                            </p>
                          </div>
                          {amount ? (
                            <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                              {amount}
                            </span>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-border bg-muted/40 px-3 py-1.5">
            <p className="text-[10px] leading-tight text-muted-foreground">
              Search is powered by an Amazon OpenSearch read-model (CQRS) — the canonical figures are
              still computed by the deterministic engine.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
