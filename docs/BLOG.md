# Are your books actually complete? Building Archon, a document-correlation engine, on the Vercel + AWS "zero stack"

*A build log for the H0: Hack the Zero Stack hackathon — a v0-built Next.js front end on Vercel, AWS DynamoDB on the back, AWS Bedrock vision reading the documents, and a deterministic CFO engine that correlates them and tells you whether every number reconciles.*

<!-- Where to publish: Medium / personal blog. Lightly personalize the voice before posting. -->

> **Live demo:** https://h0-archon.vercel.app · **~2:45 walkthrough:** https://h0-archon.vercel.app/archon-h0-demo.mp4 · **Code (MIT):** https://github.com/upgradedev/h0-archon

## The problem: your books are split across documents that nobody reconciles

Every month, a small-business owner closes their books from a pile of documents that never quite line up: a bank statement, payroll files, sales invoices, purchase invoices, receipts. Each describes a different part of the same month, and there is no obvious way to connect them. So they correlate it all by hand — every month.

**Archon is a document-collection and auto-correlation engine.** You hand it everything your business receives, and it gathers the documents, links the related ones into single financial events, and answers one question: *are your books complete and reconciled?*

The clearest way to see why correlation matters is a single payroll event. It produces three documents that each tell only part of the story:

1. **The bank confirmation** — the net cash that actually left the account.
2. **The payroll register** — gross pay, taxes, employee IKA, *employer* IKA: the true cost to the company.
3. **The individual payslips** — the per-employee breakdown.

On the books of our demo company, **ARCHON DEMO IKE** (a small Athens software consultancy), the **January 2026** bank transfer to staff totals **€3,994.74**. The true employer cost — gross pay plus the employer's own IKA social-security contribution (26% of gross), the figure that belongs in the P&L — is **€6,930.00**. The difference is **€2,935.26**: employer IKA plus the employee IKA and tax withheld from gross. That is about **42% of the true cost**, roughly €35,000 a year — and it is *not a scandal*. It is the ordinary employer-IKA-and-tax wedge that a single-document, bank-only view simply never records. It only becomes visible because Archon **correlated the payroll register with the bank transfer**. Without the register, you would only ever see the bank line.

That is the whole product, generalized across purchases, sales, payments, receipts, and payroll: collect every document, link the related ones into one event, and tell the owner whether the close is complete — or whether a document is missing. For H0, the question was: *how little stack do you need to ship that as a real product?*

## The "zero stack": v0/Vercel on the front, AWS databases on the back

The H0 premise is that you can build a production-shaped full-stack app with almost no infrastructure: a Vercel front end and one managed AWS database, nothing to provision, nothing to babysit. We took that literally.

- **Front end + API:** a single Next.js 16 App Router project deployed on Vercel. The dashboard itself was scaffolded in **Vercel v0** and then wired to live data — Tailwind v4, framer-motion, and Recharts, with a dark-mode toggle — so the surface looks like a real product, not a hackathon stub. Every API route (`/api/report`, `/api/intake`, `/api/ask`, `/api/evidence`, `/api/history`, `/api/run`) is a Vercel Function.
- **Database:** **AWS DynamoDB**, accessed only from the server. The live deployment reports `db_mode: "aws-dynamodb"` straight out of `/api/report`, so the sponsor stack is verifiable in one `curl`.
- **No server to manage:** Vercel Functions are stateless; all durable state — every finance-close report and every user interaction — lives in DynamoDB.

That is the whole production footprint. There is no Kubernetes, no container, no connection pool to tune, no idle VM burning money between demos.

## Why DynamoDB, and the single-table design

Our access patterns are boring in the best way:

- *Show me the latest close.*
- *Show me recent closes.*
- *Show me recent product activity (document intakes and questions asked).*

Every one of those is a partition read with a descending sort — exactly what DynamoDB is built for. So we used a **single-table design** with two record types:

| Record | `pk` | `sk` | Payload |
|---|---|---|---|
| Finance-close report | `REPORT` | `<ISO generated_at>#<event_id>` | the full report |
| Intake / Q&A activity | `ACTIVITY` | `<ISO created_at>#<activity_id>` | the activity |

"Latest report" is a `Query` on `pk = REPORT`, `ScanIndexForward: false`, `Limit: 1` — single-digit milliseconds, no `Scan` anywhere in the data layer, no secondary index needed. History and the activity feed are the same query without the limit. The ISO-8601 timestamp prefix on the sort key means lexicographic ordering *is* chronological ordering, for free.

One bug worth confessing, because it is the kind that only bites in production: the REPORT sort key was originally just the timestamp. Two closes generated in the same millisecond (easy to do in CI bursts) would collide and **silently overwrite** each other. The fix was to append `#<event_id>` to the sort key — the same guard the ACTIVITY records already had. The timestamp still dominates the sort, so ordering is unchanged, but no two reports can ever clobber one another. Old and new items coexist with zero migration.

The table also carries a clean upgrade path to multi-tenant — `TENANT#<id>#REPORT` — without a schema change, which is the quiet superpower of single-table design.

## The deliberately boring analysis engine

Here is the decision I expect to get questions about: **a vision model reads the documents, but no model decides your numbers.** Extraction uses **AWS Bedrock vision** (`eu.anthropic.claude-sonnet-4-6`, Claude Sonnet 4.6, in `eu-west-1`) to turn messy PDFs into structured fields — measured at **96.7% field-level accuracy (58/60)** and **100% document classification (15/15)** against a labelled corpus, at roughly **$0.17 per run**. But the CFO analysis — P&L, EBITDA, cash movement, sales-vs-goal, purchase concentration, and the payroll completeness check — runs on a **deterministic finance rules engine**, not a model. Even the executive summary is generated deterministically from the computed figures, not written by an LLM. *AI reads; deterministic rules compute.*

That is a feature, not a shortcut. A finance-close tool that gives a *different* answer each time you run it is worse than useless; it is a liability. Determinism means:

- **Auditability.** Every number traces to a source document and a rule. The app emits source citations for its claims.
- **Reproducibility.** A judge — or an auditor — can run `npm run ci` with no cloud credentials and get the exact same figures, because the engine falls back to an in-process store in demo mode.
- **Completeness.** The four cross-document checks either confirm the documents agree, or name the one that doesn't:
  - **R1** — bank net transfer ≈ sum of payslip net pay (±2%). *Pass: €3,994.74 vs €3,994.74.*
  - **R2** — employer IKA ratio within the Greek statutory band. *Pass: 26% of gross.*
  - **R3** — payment date present and consistent across documents.
  - **R4** — employee count consistent between register and payslips.

If those four checks pass, every document type is present, cross-linked, and reconciled — the close is complete. If one fails, you know exactly which document disagrees, and Archon withholds the close until it is reconciled. That is the part a language model cannot give you.

And because that completeness guarantee *is* the product, I made it something you can watch. The dashboard has a **stress-test**: it deliberately corrupts one extracted field — simulating a missing or mis-read document — and you see R1 flip to **FAILED** (*e.g. "bank €4,600 vs payslips €3,995 · Δ 15% — the bank confirmation disagrees with the payslips"*) and the report **withheld until reconciled** instead of published. The AI reads; the deterministic engine correlates and only releases a close once the documents are complete and agree. For a tool that touches money, "won't publish a close that doesn't reconcile" is the feature that matters most.

## What the judge (and the owner) actually sees

The dashboard is intentionally dense — a work surface, not a landing page. The first viewport carries the whole monthly close: P&L revenue **€47,200**, EBITDA **€30,698** (a 65% margin), sales-goal attainment **101.5%**, closing cash **€79,498**, a supplier-concentration watch flag (AI-model spend at **28%** of COGS), and the payroll completeness panel front and center. A **P&L Sankey** traces revenue down through COGS and operating cost to EBITDA, and the payroll panel drills into a **per-employee breakdown** so you can see who the cost belongs to.

Above all of it sits a **reporting-period selector** — January through May 2026, plus an "All periods" aggregate — with **trend line charts** that show revenue, cost, and the payroll wedge moving month to month. One honesty note I keep visible in the product: **January 2026 is the live extraction** (the documents Bedrock actually read this run); **February–May are clearly-labelled projected trends, and the customer/supplier account statements are sample data** — the dashboard carries a "Demo data" badge so nobody mistakes the illustrative history for a real close. The **customer and supplier statements** (AR/AP) let you click straight through to the underlying invoices, which is the drill-down an accountant actually wants.

Driving it all is an **eight-stage agent run ledger** — Extractor → Classifier → Event Linker → Validator → PnL → CashFlow → Employee → Narrator — an "Ask Archon" panel that answers questions like *"What is the true payroll cost versus the bank statement?"* with citations back to the source documents, and a persisted activity trail backed by DynamoDB.

## What "production in minutes" really bought us

The honest scorecard of the zero stack:

- **Time-to-live** was dominated by writing product logic, not wiring infrastructure. The database was a table definition and four IAM actions (`PutItem`, `Query`, scoped to one ARN).
- **Cost at demo scale is effectively zero** — two partitions, tiny items, DynamoDB on-demand billing, Vercel's serverless tier.
- **The resilience story is real:** DynamoDB → Aurora PostgreSQL fallback → embedded-demo, chosen at runtime by which environment variables are present. The same code runs on a judge's laptop with no AWS account and in production against a real table.
- **CI is a full pyramid:** typecheck, unit tests for the pipeline / data layer / insights model (**86% line coverage**), a production build, a deterministic pipeline run, and a live smoke test against the deployed Vercel + DynamoDB endpoints.
- **The infrastructure is codified:** the whole AWS footprint lives in **Terraform** (`terraform/`) — the DynamoDB table and its stream, the scoped IAM grants, and a **CQRS read-model on Amazon OpenSearch** (fed by a DynamoDB-Streams → Lambda projector) for search and analytics at scale. The data tier reproduces — or tears down — with one command, which is the difference between a demo and something an auditor would trust.

The lesson H0 is really teaching: when the stack collapses to "a front end and a database," the thing that differentiates a demo from a product isn't the infrastructure — it's whether your numbers are *correct, cited, and reproducible*. For a finance tool, that is the entire game.

> *"We ran Archon on our own books at Reflective IKE — it pulled together the bank, payroll and invoices and told us in seconds that everything reconciled. That used to take our accountant the better part of a day."* — Founder, Reflective IKE

---

*Archon H0 is live at https://h0-archon.vercel.app (~2:45 walkthrough: https://h0-archon.vercel.app/archon-h0-demo.mp4) and open-source at https://github.com/upgradedev/h0-archon. The architecture diagram, AWS DynamoDB proof, and full submission package are in the repo's `docs/` directory.*


---
*I created this content for the purposes of entering the H0: Hack the Zero Stack with Vercel v0 and AWS Databases hackathon. #H0Hackathon*
