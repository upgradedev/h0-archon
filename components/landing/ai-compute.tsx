import { ScanText, ArrowRight, Binary, ShieldCheck } from "lucide-react"
import { Reveal } from "./reveal"

const steps = [
  {
    icon: ScanText,
    tag: "AI reads",
    title: "Vision models extract the facts",
    body: "Claude Sonnet vision reads invoices, statements and payslips — pulling structured fields from messy, real-world documents.",
  },
  {
    icon: Binary,
    tag: "Rules compute",
    title: "A deterministic engine does the math",
    body: "No model touches your totals. Accounting rules turn extracted facts into books that reproduce exactly, every time.",
  },
  {
    icon: ShieldCheck,
    tag: "You defend",
    title: "Every figure traces to a source",
    body: "Drill from any number back to the document and rule that produced it — built for the review, not just the dashboard.",
  },
]

export function AiCompute() {
  return (
    <section id="engine" className="border-y border-border bg-secondary/40 px-6 py-24 md:py-32">
      <div className="mx-auto max-w-6xl">
        <Reveal className="max-w-2xl">
          <p className="text-sm font-medium text-primary">How it works</p>
          <h2 className="mt-3 text-balance font-heading text-3xl font-medium tracking-tight md:text-4xl">
            AI reads. Deterministic rules compute.
          </h2>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            The intelligence sits in reading documents — never in inventing
            numbers. That separation is what makes the close auditable.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 md:grid-cols-3 md:gap-4">
          {steps.map((s, i) => (
            <Reveal key={s.tag} delay={i * 0.1} className="relative h-full">
              <div className="flex h-full flex-col rounded-2xl border border-border bg-card p-7">
                <div className="flex items-center justify-between">
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <s.icon className="size-5" />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {s.tag}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-medium tracking-tight">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {s.body}
                </p>
              </div>
              {i < steps.length - 1 && (
                <span className="absolute -right-3 top-1/2 z-10 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground md:flex">
                  <ArrowRight className="size-3.5" />
                </span>
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
