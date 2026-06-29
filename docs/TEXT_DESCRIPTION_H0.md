# Archon H0 — Devpost Description

> Paste this into the Devpost project text fields. Live app: **https://h0-archon.vercel.app** · Repo: **https://github.com/upgradedev/h0-archon**

---

## Inspiration

Ask a small-business owner what payroll costs them, and they'll read their bank statement. That number is wrong. On our sample books the bank shows **€5,957** transferred to staff — but the true employer cost is **€9,111**. The €3,154 gap, every month, is employer social security and withheld taxes that simply never appear on the bank confirmation. Across our full labelled test corpus, bank-only bookkeeping understates true cost by **€314,000 — about 61.7% over the bank figure**. SMBs budget, price, and hire against a number that's quietly off by a third or more. Archon recovers it.

## What it does

**Archon H0 is a monthly finance close for SMBs, running entirely on Vercel + AWS DynamoDB.** It turns fragmented finance files into one auditable CFO command center: P&L, account-statement cash movement, sales performance versus goal, purchase concentration risk, and payroll controls — each number backed by a source citation and an ask-the-report Q&A.

It runs a seven-step close: **intake** the documents → **classify** them → **extract** the fields with AWS Bedrock vision → **link** the three payroll views into one monthly event → **validate** with cross-document rules → **persist** to AWS DynamoDB → **analyze** into CFO-ready intelligence.

The live sample exposes the full picture, not just payroll: Revenue **€96,800**, EBITDA **€20,889**, sales goal attainment **96.8%**, closing cash **€58,789**, purchase concentration (fresh produce at **42.7% of COGS**), and the payroll-truth finding — bank-visible net **€5,957** vs true employer cost **€9,111**, a hidden **€3,154/month**.

**The design principle, in one line: the AI reads the documents; deterministic rules compute the books.** AWS Bedrock vision handles messy, real-world inputs; a deterministic, auditable rules engine produces every reported figure — so the product generalizes to scanned Greek PDFs while every number stays reproducible and citable.

## Who it's for

Small and mid-sized businesses and the bookkeepers/accountants who close their month — the ones without a finance department, who today reconstruct the truth by hand across a bank app, a payroll register, and a stack of payslips. (Built and tuned on Greek-language SMB finance documents, where the employer-IKA gap is large and routinely missed.)

## How AWS Bedrock reads the documents — measured 96.7%

Extraction is not a mock. AWS Bedrock vision (**Claude Sonnet 4.6**, `eu.anthropic.claude-sonnet-4-6`, region `eu-west-1`) reads rendered PDFs and returns structured fields. We measured it against a labelled corpus with a real eval harness:

- **96.7% field-level accuracy** (58/60 fields), **100% document classification** (15/15) on a stratified sample, against a perfect-extraction ceiling of 100%.
- Classification is **content-only** — the filename is never sent to the model (verified by the extraction unit tests), so the metric is honest.
- Cost: ≈ **$0.17** for the run. Reproducible: see `eval/LIVE_EXTRACTION.md`.

This matters because most rivals show a demo; Archon ships a **measured-accuracy eval harness, tests, CI, and content** — a number you can reproduce, not a claim.

## The AWS DynamoDB integration (deliberate single-table design)

The production deployment persists to **AWS DynamoDB** (selected via `DYNAMODB_TABLE`). It's a **single-table design**, chosen on purpose for a serverless app:

| Record | `pk` | `sk` | Payload |
|---|---|---|---|
| Finance close report | `REPORT` | ISO `generated_at` | full report, event id |
| Intake / Q&A activity | `ACTIVITY` | ISO `created_at#activity_id` | activity kind, summary |

This serves every access pattern as a direct partition-key read: latest report (`pk=REPORT`, desc `sk`, limit 1), recent history, and recent product activity. Vercel Functions stay stateless; all durable state lives in AWS; writes are small, append-oriented, and naturally partitioned by record type; and the same key structure extends cleanly to multi-tenant (`TENANT#<id>#REPORT`).

**Public, verifiable proof** (no login):
- `/api/report` and `/api/evidence` return `db_mode=aws-dynamodb` and `records=REPORT+ACTIVITY`.
- `/api/history` returns persisted REPORT runs *and* ACTIVITY records.
- The figures in `/api/evidence` (`revenue`, `ebitda`, `payroll_gap`) match the items in the DynamoDB console — identical numbers on both sides prove the deployed Vercel app reads and writes this exact table. See `docs/DYNAMODB_PROOF.md`.

## Vercel deployment depth

- **Next.js App Router** on Vercel; the CFO rules engine, document-intake, and ask-report all run as **Vercel Functions** — stateless, with DynamoDB as the only durable store.
- **CI/CD (GitHub Actions):** install → typecheck → unit tests → production build → deterministic pipeline evidence artifact → **live production smoke** against the deployed Vercel + DynamoDB stack (report, intake, ask, history).
- **Security scan** in CI (gitleaks) — extraction also carries a prompt-injection guardrail: any directive *inside* a document is treated as data, never followed.
- **Eval harness** (`npm run eval`): ground-truth corpus + scorer + honest baselines (ceiling, naive floor, sensitivity), so accuracy and impact are reproducible numbers, not assertions.
- Public APIs (`/api/report`, `/api/evidence`, `/api/history`, `/api/intake`, `/api/ask`) give judges an ungated path to verify everything in seconds.

## How we built it

TypeScript end to end. The extraction layer ports a battle-tested Python pipeline (extractor + deterministic classifier + null-safe LLM-JSON parsing) to TypeScript against the AWS Bedrock Converse API; PDFs are rasterized in-process (mupdf WASM — no native build, no GPU). The fusion/validation/analysis core is pure deterministic functions, which is exactly what makes the eval harness — and every reported euro — reproducible.

## Challenges

Bedrock model entitlement is region-scoped — Claude Sonnet 4.6 resolved only in `eu-west-1` (us-east-1/us-west-2 returned ResourceNotFound) after the one-time Anthropic use-case form. Designing R2/R4 so they validate against the register without false-failing legitimate non-standard contribution rates took a real generalization pass (documented in `eval/BASELINE.md`).

## Accomplishments

A **measured** 96.7% extraction number, a **quantified** €314k impact, a clean single-table AWS data model with public proof, and full CI with live smoke — the things most hackathon entries assert but can't show.

## What's next

Multi-tenant keys (already designed into the table), more document types, and a longer historical trend view across persisted REPORT runs.

---

## New & Existing compliance

Archon's **concept** pre-existed: earlier builds ran on other clouds. **Everything submitted here — the Vercel + AWS DynamoDB application, the single-table data model, and the AWS Bedrock (Claude Sonnet 4.6) extraction layer with its measured 96.7% eval — was built new during the H0 submission period.** This H0 stack (Next.js on Vercel, DynamoDB persistence, Bedrock vision, the eval harness, CI, and live smoke) is original to this window and was not carried over from a prior submission. We claim only what is new this window; we do not claim v0 provenance unless a real v0 artifact is attached (see `docs/V0_USAGE.md`).

---

## Judging criteria map

| Criterion | Evidence |
|---|---|
| **Technological Implementation** | Vercel Next.js + Functions; **AWS Bedrock vision extraction, measured 96.7%**; **AWS DynamoDB single-table** persistence (`pk=REPORT`/`ACTIVITY`); repository-pattern data layer; labelled eval harness; unit tests; CI with production build + **live smoke**; ungated public APIs. |
| **Design** | Dense single-viewport CFO dashboard — document intake, seven-step run ledger, P&L, cash, sales, purchases, citations, Ask Archon Q&A, persisted history. Clean "AI reads → deterministic rules compute" split. |
| **Impact** | A real SMB problem, **quantified**: bank-only bookkeeping understates true cost by **€314k / 61.7%** across the corpus (≈28% from the employer-IKA wedge alone). Archon recovers it, with citations and auditable controls. |
| **Originality** | Verification-gated three-document fusion — Bedrock vision proposes; a deterministic engine plus cross-document rules (a real register-vs-payslip check) verify; every number is auditable and reproducible. A measured eval harness + tests + CI + content that most entries lack. |

---

## Links

- **Live app:** https://h0-archon.vercel.app
- **Repo:** https://github.com/upgradedev/h0-archon
- Live report API: https://h0-archon.vercel.app/api/report
- Judge evidence API: https://h0-archon.vercel.app/api/evidence
- History API: https://h0-archon.vercel.app/api/history
- CI: https://github.com/upgradedev/h0-archon/actions/workflows/h0-archon-ci.yml
