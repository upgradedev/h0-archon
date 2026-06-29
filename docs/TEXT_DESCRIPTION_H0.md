# Archon H0 — Devpost Description

> **This is a humanized draft in a founder voice, modeled on the narration arc of our Azure demo but re-platformed and made honest for H0 (Vercel + AWS Bedrock + DynamoDB).** Before you submit: read it aloud, cut anything that doesn't sound like *you*, and add a sentence or two of your own — judges read dozens of these and spot the generic ones. Live app: **https://h0-archon.vercel.app** · Repo: **https://github.com/upgradedev/h0-archon**

---

## The problem we kept watching people live with

Every month, a small-business owner sits down to close their books. They have a bank statement. They have payroll documents. They have invoices, receipts, tax filings. Each one tells a different version of the same month — different amounts, different dates, and no obvious way to connect them.

To know their true financial position, they have to correlate all of it by hand. Every single month.

Here's the part that bothered us most. A single payroll event — paying your staff for one month — produces at least three documents that each tell only part of the story:

- The **bank statement** shows what actually left the account: net salaries. It's incomplete without context.
- The **payroll register** holds the full employer cost — gross pay plus employer social-security contributions — the number that actually belongs in your P&L.
- The **individual payslips** break it down per person: gross, deductions, tax withheld.

They describe the same event, but you can't match them by amount alone — they need correlation. So most businesses just record the bank line, and their P&L is incomplete: it captures the cash that moved, not the full employer cost the register holds.

On our demo books — **ARCHON DEMO IKE**, January 2026 — the bank shows **€3,994.74** going to staff. The true employer cost is **€6,930.00**. That **€2,935.26** difference — employer IKA plus the employee IKA and tax withheld from gross — never shows up on the bank confirmation, and it's *not a scandal*: it's the ordinary employer-IKA-and-tax wedge that's only visible once Archon correlates the payroll register with the bank transfer. Without the register, you'd only ever see the bank line. (Across our full labelled eval corpus, a naive single-document view would miss **€314,000** that's recoverable only once the documents are correlated.) People price, budget, and hire against the bank number alone — and it's incomplete.

## What Archon does

Archon turns that pile of documents into one accurate, auditable monthly close — and it does the correlation for you.

**Upload.** Drop your documents in — bank statements, payroll files, invoices — and Archon takes it from there.

**The agents correlate.** A pipeline of specialised agents reads every document, classifies it, links the related documents across types into a single financial event, validates them against each other, and reconciles the numbers.

**You get an accurate close.** Not just payroll — a full financial command center: P&L, cash flow, sales performance against goal, purchases and supplier concentration, working capital, and payroll controls. Every figure traces back to the source document it came from, and you can ask the report a plain-English question and get an answer.

The piece we're proudest of is the **Event Linker** — the agent that looks across document types and says: *this bank transfer, this payroll register, and these payslips are all the same event. Fuse them. Report the true number.* That correlation used to take a skilled accountant hours. Here it takes seconds.

## How it's built — and why it's trustworthy

Archon H0 runs entirely on the zero stack: **Next.js on Vercel, with AWS DynamoDB and AWS Bedrock.**

The principle, in one line: **the AI reads the documents; a deterministic engine computes the books.**

- **AWS Bedrock vision (Claude Sonnet 4.6)** reads the raw, messy, scanned documents and returns structured fields. This isn't a mock — we measured it against a labelled corpus with a real eval harness: **96.7% field-level accuracy** and **100% document classification**, for about **$0.17** a run. The filename is never sent to the model, so the number is honest. (See `eval/LIVE_EXTRACTION.md`.)
- **A deterministic rules engine** does the rest — classify, link the event, run four cross-document consistency checks, and compute every reported figure. Because the math is deterministic, there's no language model inventing numbers: every euro is reproducible and you can defend it in a review. The executive summary is generated from those computed figures, not free-written by a model.
- **AWS DynamoDB** persists every close and every activity in a deliberate single-table design (`pk=REPORT` / `pk=ACTIVITY`), so each read is a direct partition-key lookup and Vercel's functions stay stateless. It extends cleanly to multi-tenant.

## What you'll see in the live app

Open the dashboard and it's live, reading real data from DynamoDB. Revenue is shown net of tax — actual income, not invoice face value. The payroll tile shows the true employer cost from the register, not the net bank transfer — and surfaces the wedge that's only visible once the documents are correlated. You can switch the **reporting period across January–May 2026**, watch the **trend lines** move, open **customer and supplier account statements** down to individual invoices, expand **per-employee** payroll detail, and flip the whole thing to **dark mode**. Every claim carries a source citation, and "Ask Archon" answers questions about the report in natural language.

*(One honest note we put right on the screen: January is the live extracted close; the later months and the customer/supplier ledger are clearly labelled sample data, so nothing on the dashboard pretends to be more real than it is.)*

## Why it matters

A real problem, quantified: across our labelled corpus, a naive single-document view would miss **€314k** of cost — recoverable only once Archon collects and correlates the documents, with citations and auditable controls, in minutes instead of days. Most hackathon entries assert their value. We can show you a measured accuracy number, a quantified impact, a public data-proof endpoint, and CI that smoke-tests the live Vercel + AWS stack on every push.

---

## Links
- **Live app:** https://h0-archon.vercel.app
- **Repo:** https://github.com/upgradedev/h0-archon
- Live report API: https://h0-archon.vercel.app/api/report · Evidence: /api/evidence · History: /api/history
- CI: https://github.com/upgradedev/h0-archon/actions/workflows/h0-archon-ci.yml

## Judging criteria map (keep or cut — for your reference)
| Criterion | Evidence |
|---|---|
| **Technological Implementation** | Next.js + Vercel Functions; **AWS Bedrock vision, measured 96.7%**; **DynamoDB single-table**; deterministic auditable engine; eval harness; tests; CI with production build + **live smoke**; 86% test coverage; ungated public APIs. |
| **Design** | Modern CFO command center (Tailwind, motion, recharts): period selector, trend charts, P&L Sankey, cash flow, sales, suppliers, working capital, payroll with per-employee detail, account statements with drill-down, citations, Ask-Archon, dark mode. |
| **Impact** | Quantified: a naive single-document view would miss **€314k** of cost across the corpus — much of it the employer-IKA-and-tax wedge that only a correlated view records. Recovered with citations + auditable controls. |
| **Originality** | Document-collection + auto-correlation engine — Bedrock vision reads, a deterministic engine + cross-document rules link every document into one event and confirm the close is complete; every number auditable. Measured eval + tests + CI that most entries lack. |

## New & existing compliance
The *concept* pre-existed (earlier builds ran on other clouds). Everything submitted here — the Vercel + AWS DynamoDB app, the single-table model, and the AWS Bedrock extraction layer with its measured eval — was **built new during the H0 window**. We claim only what's new this window and do not claim v0 provenance unless a real v0 artifact is attached.
