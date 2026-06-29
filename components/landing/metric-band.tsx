import { CountUp } from "./count-up"
import { Reveal } from "./reveal"

const metrics = [
  {
    label: "Field-level extraction accuracy",
    node: <CountUp value={96.7} decimals={1} suffix="%" />,
    sub: "measured on a labelled eval corpus",
  },
  {
    label: "Documents cross-linked",
    node: <CountUp value={100} suffix="%" />,
    sub: "every event reconciled to source",
  },
  {
    label: "Cross-document checks",
    node: <CountUp value={4} />,
    sub: "passed before any close is released",
  },
  {
    label: "Monthly close time",
    node: <CountUp value={5} prefix="<" suffix=" min" />,
    sub: "complete & reconciled, not days of work",
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
