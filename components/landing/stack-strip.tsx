import { Triangle, Database, BrainCircuit } from "lucide-react"
import { Reveal } from "./reveal"

const stack = [
  {
    icon: Triangle,
    name: "Next.js on Vercel",
    detail: "Edge-rendered app, deployed continuously",
  },
  {
    icon: Database,
    name: "AWS DynamoDB",
    detail: "Single-table design for every entity",
  },
  {
    icon: BrainCircuit,
    name: "AWS Bedrock",
    detail: "Claude Sonnet 4.6 vision extraction",
  },
]

export function StackStrip() {
  return (
    <section id="stack" className="px-6 py-20">
      <div className="mx-auto max-w-6xl">
        <Reveal className="text-center">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Built on infrastructure you already trust
          </p>
        </Reveal>
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
          {stack.map((s, i) => (
            <Reveal
              key={s.name}
              delay={i * 0.08}
              className="flex items-center gap-4 bg-card px-6 py-6"
            >
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-border text-foreground">
                <s.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
