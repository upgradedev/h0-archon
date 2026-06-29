import { CountUp } from "./count-up"
import { Reveal } from "./reveal"

const metrics = [
  {
    label: "Field-level extraction accuracy",
    node: <CountUp value={96.7} decimals={1} suffix="%" />,
    sub: "across invoices, statements, payroll",
  },
  {
    label: "Hidden employer cost surfaced",
    node: <CountUp value={28} suffix="%" />,
    sub: "beyond headline gross pay",
  },
  {
    label: "Understatement found",
    node: <CountUp value={314} prefix="€" suffix="k" />,
    sub: "across the test corpus",
  },
  {
    label: "Monthly close time",
    node: <CountUp value={5} prefix="<" suffix=" min" />,
    sub: "not days of spreadsheet wrangling",
  },
]

export function MetricBand() {
  return (
    <section className="border-y border-border bg-card">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border md:grid-cols-4">
        {metrics.map((m, i) => (
          <Reveal
            key={m.label}
            delay={i * 0.08}
            className="bg-card px-6 py-10 text-center md:py-12"
          >
            <p className="font-heading text-3xl font-semibold tracking-tight md:text-4xl">
              {m.node}
            </p>
            <p className="mt-2 text-sm font-medium">{m.label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{m.sub}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
