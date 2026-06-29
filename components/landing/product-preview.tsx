import { TrendingUp, ArrowDownRight, ArrowUpRight, Circle } from "lucide-react"

const bars = [42, 55, 48, 63, 58, 71, 66, 78, 74, 86, 81, 92]
const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]

const ledger = [
  { label: "Revenue", value: "€96,800", trend: "+8.2%", up: true },
  { label: "Cost of sales", value: "€67,388", trend: "-2.1%", up: false },
  { label: "Gross profit", value: "€29,412", trend: "+12.4%", up: true },
  { label: "Operating expenses", value: "€18,140", trend: "+1.6%", up: false },
]

export function ProductPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-foreground/10">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
          <span className="size-2.5 rounded-full bg-border" />
        </div>
        <div className="flex items-center gap-2 rounded-md bg-card px-3 py-1 text-xs text-muted-foreground">
          <Circle className="size-2 fill-primary text-primary" />
          Monthly close · March 2026 · finalized
        </div>
        <span className="text-xs font-medium text-primary">Auditable</span>
      </div>

      <div className="grid gap-px bg-border md:grid-cols-5">
        {/* main chart panel */}
        <div className="bg-card p-6 md:col-span-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Net revenue</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                €96,800
              </p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-xs font-medium text-accent-foreground">
              <TrendingUp className="size-3" />
              30.4% margin
            </span>
          </div>

          <div className="mt-8 flex h-32 items-end gap-1.5" aria-hidden="true">
            {bars.map((h, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-sm bg-primary/15"
                  style={{ height: `${h}%` }}
                >
                  <div
                    className="w-full rounded-sm bg-primary"
                    style={{ height: i === bars.length - 1 ? "100%" : "0%" }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {months[i]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ledger panel */}
        <div className="bg-card p-6 md:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">
            Profit &amp; loss
          </p>
          <ul className="mt-4 space-y-3.5">
            {ledger.map((row) => (
              <li
                key={row.label}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{row.label}</span>
                <span className="flex items-center gap-2">
                  <span className="font-medium tabular-nums">{row.value}</span>
                  <span
                    className={
                      row.up
                        ? "inline-flex items-center text-xs text-primary"
                        : "inline-flex items-center text-xs text-muted-foreground"
                    }
                  >
                    {row.up ? (
                      <ArrowUpRight className="size-3" />
                    ) : (
                      <ArrowDownRight className="size-3" />
                    )}
                    {row.trend}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
            <span className="text-sm font-medium">Closing cash</span>
            <span className="text-sm font-semibold tabular-nums">€58,789</span>
          </div>
        </div>
      </div>
    </div>
  )
}
