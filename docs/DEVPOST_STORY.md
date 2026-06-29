## Inspiration

Every month a small business closes its books — and the truth of that month is scattered across documents that don't talk to each other: a bank statement, a payroll register, individual payslips, supplier invoices, receipts. Each tells only part of the story, so owners (and their accountants) correlate them by hand, every month.

The insight that started Archon: a single payroll event produces three documents that *disagree on purpose*. The bank confirmation shows the **net** that left the account (€3,994.74). The payroll register holds the **true employer cost** — gross pay plus employer social-security (€6,930). That €2,935 gap — in our demo it's Greece's IKA plus withheld tax, but **every country has its own version of this employer-cost wedge** — is **invisible until you correlate the register with the bank transfer**. Bank-only accounting simply can't see it. The correlation problem is universal; only the local rules change. We wanted software that does that correlation for any SMB and tells you one thing: are your books complete and reconciled, or are you missing a document?

## What it does

Archon ingests a month's raw business documents and produces a boardroom-ready P&L close.

- **Drop a document on the dashboard** and watch eight agents work in sequence: the Extractor reads it live with **AWS Bedrock** vision, then the engine classifies it, links related documents into one financial event, validates them against each other, and recomputes the close — the affected tiles flash and update in front of you.
- **Verification-gating:** four cross-document checks (R1–R4) must pass before a close is trusted; a built-in stress-test deliberately corrupts a field to show the completeness check catch a missing document.
- **Documents-first search:** find any invoice by **number and date** (e.g. `AR-HA-003-001 · Sales invoice · 2026-01-22 · €3,304 · paid`), not just rolled-up totals.
- **A self-guided tour** walks any visitor through the whole flow.

**Who pays (B2B SaaS).** SMB owners and the accounting firms that close their books — a per-entity monthly subscription, with a multi-client tier for firms that close dozens of SMBs a month. The ROI is concrete: Archon turns a full day of manual document-correlation per monthly close into minutes — an accountant-day saved every month, per entity — and it surfaces costs (like the employer-cost wedge) that bank-only bookkeeping silently misses.

Live: https://h0-archon.vercel.app · Code (MIT): https://github.com/upgradedev/h0-archon

## How we built it

The "zero stack": **Next.js 16 / React 19 on Vercel** for the front and API (Vercel Functions), with the real work on **AWS**:

- **Amazon DynamoDB** — single-table design (REPORT + ACTIVITY items) is the source of truth for every close and product event. **We chose DynamoDB over Aurora** because the access patterns are simple and known (latest close, closes over time, recent activity) — they map cleanly to partition + sort-key queries with single-digit-ms reads, no connection pool to manage, and per-request pricing that's near-free at this scale; a serverless front (Vercel Functions) pairs naturally with a serverless, connectionless datastore.
- **Amazon Bedrock** (Claude Sonnet 4.6) — vision extraction via Converse `document` blocks (PDF-direct), ~96.7% measured field accuracy on a labelled corpus.
- **Amazon OpenSearch** — a CQRS read-model fed from DynamoDB that powers documents-first search; it never computes a canonical number.
- **The guiding principle: the AI reads, a deterministic engine computes.** No LLM ever touches a number — the same inputs always produce the same books, and every figure traces back to a source document. That's what makes the close auditable.
- Terraform IaC for the whole data tier; GitHub Actions CI runs gitleaks + CodeQL + typecheck/test/build + a live smoke that hard-asserts `db_mode=aws-dynamodb`.

## Challenges we ran into

- **Drawing the AI/determinism line.** Letting an LLM "just compute the totals" is tempting and wrong — it kills auditability. Confining Bedrock strictly to *reading* and routing every number through deterministic rules was the key design discipline.
- **Single-table modeling.** Getting a collision-proof sort key (`<generated_at>#<event_id>`) and the access patterns right took iteration — but removed an entire relational layer.
- **Deploy ops.** Vercel's Git auto-deploy stalled mid-sprint; we built a manual GitHub Actions deploy workflow (Vercel CLI + secrets) as a reliable fallback.
- **Trust, verified.** We caught the production app briefly serving stale data during a video render by checking the output frame-by-frame — a reminder that "it deployed" isn't "it's correct."

## Accomplishments that we're proud of

- A **live, working** product on the zero stack — not a mockup.
- **96.7% measured** extraction accuracy, with every downstream number deterministic and auditable.
- The **payroll-truth insight** made tangible: €3,995 vs €6,930, with the €2,935 wedge surfaced only once documents are correlated.
- Real engineering rigor: documents-first search with number+date, Terraform IaC, and a CI pipeline that gates on live AWS behavior.

## What we learned

- **Let the LLM read, never compute** — it's the cleanest way to get AI leverage without losing auditability.
- **CQRS** keeps search rich (OpenSearch) while the source of truth (DynamoDB) stays untouched.
- A **serverless front pairs naturally with serverless data** — Vercel Functions + DynamoDB, no pool, no idle cost.
- **Verify the artifact, not the step** — frame-checking the demo caught a real data bug a green deploy hid.

## What's next for Archon : AI Financial Intelligence

- More document types (VAT returns, contracts, receipts) and direct **bank-feed** ingestion.
- **Accountant workflows** — review queues, approvals, period locking.
- Analytics scale-out on the existing OpenSearch read-model (trends, anomaly detection).
- **Global from day one:** multi-entity / multi-currency and pluggable country-specific tax packs for SMBs worldwide — starting with Greece (IKA, MyDATA) as the proof market, since the correlation engine is the same everywhere and only the local rules differ.
