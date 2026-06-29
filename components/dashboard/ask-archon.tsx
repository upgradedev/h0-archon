"use client"

import { useRef, useState } from "react"
import { useDashboardData } from "./data-context"
import { Panel } from "./primitives"
import { Button } from "@/components/ui/button"
import { Sparkles, ArrowUp } from "lucide-react"
import { cn } from "@/lib/utils"

type Msg = { role: "user" | "archon"; text: string; cites?: string[] }

type AskResponse = {
  answer?: string
  sources?: Array<{ id: string; title?: string; evidence?: string }>
}

export function AskArchon() {
  const { period, suggestedQuestions } = useDashboardData()
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "archon",
      text: `Hi — I'm Archon. The ${period} close is reconciled. Ask me anything about these numbers and I'll trace the answer back to the source documents.`,
    },
  ])
  const [input, setInput] = useState("")
  const [pending, setPending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  function scrollToEnd() {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    })
  }

  async function send(q: string) {
    const text = q.trim()
    if (!text || pending) return
    setMessages((prev) => [...prev, { role: "user", text }])
    setInput("")
    setPending(true)
    scrollToEnd()
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      })
      if (!res.ok) throw new Error(`Ask request failed: ${res.status}`)
      const data = (await res.json()) as AskResponse
      setMessages((prev) => [
        ...prev,
        {
          role: "archon",
          text:
            data.answer ||
            "I could not find a grounded answer for that — try asking about payroll, cash, sales, or suppliers.",
          cites: (data.sources ?? []).map((source) => source.id),
        },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "archon",
          text: "I couldn't reach the analysis service just now. Please try that question again in a moment.",
        },
      ])
    } finally {
      setPending(false)
      scrollToEnd()
    }
  }

  return (
    <Panel
      title="Ask Archon"
      subtitle="Grounded Q&A over your close"
      icon={<Sparkles className="size-4" />}
      bodyClassName="flex flex-col gap-3"
    >
      <div ref={scrollRef} className="max-h-64 space-y-3 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-muted/40 text-foreground",
              )}
            >
              <p>{m.text}</p>
              {m.cites && m.cites.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {m.cites.map((c) => (
                    <span
                      key={c}
                      className="rounded border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {suggestedQuestions.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void send(q)}
            disabled={pending}
            className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          void send(input)
        }}
        className="flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={pending}
          placeholder={pending ? "Archon is thinking…" : "Ask about payroll, cash, suppliers…"}
          className="h-9 flex-1 rounded-lg border border-input bg-background px-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60"
        />
        <Button type="submit" size="icon" aria-label="Send message" disabled={pending}>
          <ArrowUp className="size-4" />
        </Button>
      </form>
    </Panel>
  )
}
