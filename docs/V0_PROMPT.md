# v0 prompt pack — Archon (modern, full financial-intelligence UI)

Paste these into **v0.app** (your $30 credits). Generate the **landing** first, then the **dashboard**. v0 outputs Next.js + Tailwind + shadcn/ui — exactly what we want. Iterate with follow-ups ("make it more corporate", "add a parallax hero", etc.). Then export/"Add to Codebase" and I'll wire it to the live backend.

**Brand:** Archon. **Tone:** enterprise CFO, restrained, premium — think a finance SaaS like Ramp / Pigment / Mercury, NOT a Bootstrap admin theme. **Stack badge:** Vercel + AWS (DynamoDB + Bedrock).

---

## PROMPT 1 — Landing page

> Design a modern, elegant **landing page** for **Archon**, an agentic **financial-intelligence platform for SMBs** that turns raw business documents into a complete monthly close. Enterprise-CFO aesthetic — premium, restrained, lots of whitespace, refined typography (e.g. Inter/Geist), subtle depth. Tailwind + shadcn/ui. Tasteful motion only: a **parallax hero**, **count-up** on the metric numbers, soft fade/slide-in on scroll (framer-motion), micro-hover on cards. Dark-on-light with a deep accent (indigo/emerald). NOT a generic admin template.
>
> Sections:
> 1. **Hero** — headline: *"Every financial document your business receives, fused into one boardroom-ready monthly close."* Sub: *"AI reads your sales, purchases, bank statements and payroll; a deterministic engine computes auditable books."* Two CTAs: "Open the dashboard", "Watch the AI read a document". Parallax background, a floating product-preview card.
> 2. **Metric band** (count-up) — *product proof points, NOT a demo company's financials*: **96.7% AI extraction accuracy** · **~28% hidden employer cost** most books miss · **€314k understatement** surfaced across the test corpus · **minutes, not days** to close. (Keep the demo company's revenue/cash/margin OFF the landing — those live on the dashboard.)
> 3. **The six modules** (equal-weight feature grid, icons): **P&L** (revenue, COGS, gross profit, EBITDA) · **Cash flow** (movements, runway) · **Sales performance** (by salesperson, vs goal, margin) · **Purchases & suppliers** (spend concentration, risk) · **Receivables & payables** (customer/supplier statements, VAT, working capital) · **Payroll controls** (the hidden ~28% employer cost a bank statement misses).
> 4. **"AI reads → deterministic rules compute"** value strip — AWS Bedrock vision extracts; rules compute; every number is cited and auditable.
> 5. **Stack strip:** Next.js on Vercel · AWS DynamoDB (single-table source of truth) · AWS OpenSearch (CQRS read-model for instant search) · AWS Bedrock (Claude Sonnet 4.6 vision).
> 6. **CTA band** + minimal footer (GitHub, MIT).
>
> Make payroll just ONE of the six modules — the product is full-company financial intelligence, not a payroll tool.

## PROMPT 2 — Dashboard (the command center)

> Design a modern **financial-intelligence dashboard** for Archon — a single elegant command center, enterprise-CFO grade (Pigment/Ramp vibe), Tailwind + shadcn/ui, responsive, a slim left rail OR clean top tabs for the modules, subtle animation on load. Sections as cards/panels:
> - **Top KPI row** (count-up): Revenue, Gross margin %, EBITDA, Closing cash, Net cash, AI extraction accuracy.
> - **P&L** panel (revenue → COGS → gross profit → opex → EBITDA waterfall or table).
> - **Cash flow** panel (opening → collections → supplier payments → payroll → closing; runway months).
> - **Sales performance** table+chart **by salesperson** (owner, segment, actual vs goal, margin%) with attainment bars.
> - **Purchases & supplier concentration** (top categories/vendors, % of spend, risk pill).
> - **Working capital** (receivables, payables, VAT payable, cash-conversion gap).
> - **Payroll controls** (true employer cost vs bank transfer, the hidden €2,935 / 35.8%-of-net wedge) — one module, not the headline.
> - **Document upload** (drag a PDF, live AWS Bedrock extraction with field-accuracy scoring), **Search** (find any document/vendor/person via OpenSearch), **Document intake** (multi-type coverage chips), **eight-agent run ledger**, **verification-gating** (R1–R4 must pass before the event is trusted), **source citations**, **Ask-Archon Q&A** input.
> - A **"Run finance close"** primary action.
> Use recharts for charts. Keep it dense but breathable. Real, professional — not a toy.

---

## Data shapes (so v0 renders our real fields — give these to v0 if it asks, or I map after)

`/api/report` returns `business_intelligence`:
- `pnl`: { revenue, cogs, grossProfit, grossMarginPct, operatingExpenses, ebitda, ebitdaMarginPct, lines[] }
- `cash`: { openingBalance, closingBalance, netMovement, runwayMonths, movements[] }
- `sales`: { actual, goal, attainmentPct, weightedMarginPct, performance:[{owner, segment, actual, goal, marginPct}] }
- `purchases`: { total, categories:[{category, vendor, amount, sharePct, risk}] }
- `workingCapital`: { receivables, payables, vatPayable, cashConversionGap }
- `event` (payroll): { company, period, bank_net_total, employer_cost_total, hidden_total, cost_gap_pct, employees:[{name, gross, net, employer_cost,...}] }
- `citations`: [{id, title, claim, source, evidence}]

## After you generate
Export the v0 project (or "Add to Codebase" / download). Hand me the components/pages and I'll: wire them to the live APIs, keep the auth + DynamoDB + Bedrock backend, broaden the data, and deploy. Mention in the Devpost that the UI was generated with **Vercel v0** (real v0 provenance = bonus).
