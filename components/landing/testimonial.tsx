import { Quote } from "lucide-react"
import { Reveal } from "./reveal"

// Pilot testimonial. Placeholder quote — founder to confirm wording before launch.
export function Testimonial() {
  return (
    <section id="pilot" className="px-6 py-24 md:py-32">
      <Reveal className="mx-auto max-w-3xl">
        <figure className="relative overflow-hidden rounded-3xl border border-border bg-card px-8 py-12 md:px-14 md:py-14">
          <Quote
            aria-hidden="true"
            className="size-8 text-primary/40"
          />
          <blockquote className="mt-5 text-balance font-heading text-xl font-medium leading-relaxed tracking-tight text-foreground md:text-2xl">
            “We ran Archon on our own books at Reflective IKE — it pulled together the bank, payroll
            and invoices and told us in seconds that everything reconciled. That used to take our
            accountant the better part of a day.”
          </blockquote>
          <figcaption className="mt-6 flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              R
            </span>
            <span className="text-sm leading-tight">
              <span className="block font-medium text-foreground">Founder</span>
              <span className="block text-muted-foreground">Reflective IKE · pilot customer</span>
            </span>
          </figcaption>
        </figure>
      </Reveal>
    </section>
  )
}
