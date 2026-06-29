---
title: "Five engineering decisions behind Archon on the Vercel + AWS zero stack"
published: false
tags: [webdev, aws, nextjs, ai]
cover_image: # TODO: add cover image URL (e.g. the dashboard screenshot) before publishing
---

# Dev-log — Five engineering decisions behind Archon on the Vercel + AWS zero stack

> *I built Archon and wrote this for the **H0 Hackathon** (Hack the Zero Stack — Vercel + AWS). #H0Hackathon*
<!-- Lightly personalize the voice before posting. -->

The main write-up covers *what* Archon does (a document-collection and
auto-correlation engine that links small-business finance documents into an
auditable monthly close and tells you whether your books are complete and
reconciled — surfacing, for example, the employer's own IKA wedge that's only
visible once the payroll register is correlated with the bank transfer). The
front end was scaffolded in **Vercel v0** and wired to live data; this post is
for engineers: the five decisions that made the build clean rather than just
working.

## 1. AI reads the documents; deterministic rules decide the numbers

The obvious build for a "financial intelligence" app is to let one model read the
documents *and* emit the numbers. I split it. A **vision model — AWS Bedrock,
`eu.anthropic.claude-sonnet-4-6` (Claude Sonnet 4.6) in `eu-west-1` — reads** the
messy PDFs into structured fields (measured at **96.7% field-level accuracy
(58/60)** and **100% classification (15/15)** against a labelled corpus, ≈ $0.17
per run). But the P&L, cash, sales, purchase-concentration, and payroll-completeness
**math runs in a deterministic rules engine** — and so does the executive summary,
which is generated from the computed figures, not written by an LLM — because a
finance-close tool that returns a *different* answer each run is a liability, not a
feature. Three properties fall out of the deterministic decision layer for free:

- **Auditability** — every figure traces to a source document (bank / register /
  payslip) and a rule, and the app emits those citations for its claims.
- **Reproducibility** — `npm run ci` produces identical numbers with no cloud
  credentials, because the data layer falls back to an in-process store. (GitHub
  OAuth is implemented but intentionally *non-gating*, so judges hit the live demo
  with no login wall.)
- **Trust** — four cross-document checks (bank-net ≈ payslip-net, employer-IKA in
  the Greek statutory band, payment-date consistency, headcount consistency)
  either confirm the close is complete or name the document that disagrees. A live
  **stress-test** in the app deliberately corrupts one extracted field to simulate a
  missing or mis-read document, then shows the engine catching it and *withholding*
  the close until it reconciles — verification you can watch, not just claim.

## 2. DynamoDB single-table design — earn the abstraction

The access patterns are boring on purpose: *latest close*, *recent closes*,
*recent activity*. Each is a partition query with a descending sort, which is
exactly what DynamoDB is built for. One table, two record types:

| Record | `pk` | `sk` |
|---|---|---|
| Finance-close report | `REPORT` | `<ISO generated_at>#<event_id>` |
| Intake / Q&A activity | `ACTIVITY` | `<ISO created_at>#<activity_id>` |

"Latest" is a `Query` with `ScanIndexForward:false, Limit:1` — single-digit ms,
no `Scan` anywhere in the data layer, no GSI. The ISO-timestamp sort-key prefix
makes lexicographic order *be* chronological order.

The read side is a deliberate CQRS split: a **DynamoDB-Streams → Lambda projector
indexes into Amazon OpenSearch**, and that read-model is what powers
documents-first search. A query like `hotel` returns the individual invoices
first — each carrying its **document number and date**
(`AR-HA-003-001 · Sales invoice · 2026-01-22 · Hotel Aegeon · €3,304 · paid`) —
with vendors, people, and the counterparty aggregate after. DynamoDB stays the
source of truth; OpenSearch never computes a number, and the aggregated close and
Q&A logs are kept out of the index on purpose (they're noise when you want a
source document).

## 3. The bug worth confessing: silent overwrite on the sort key

The REPORT sort key started as just the timestamp. Two closes generated in the
same millisecond (trivial in CI bursts) collided and **silently overwrote** each
other — the worst kind of bug, because nothing errors. The fix was a sort key of
`generated_at#event_id` (the ACTIVITY records already had that guard). Old and
new items coexist with zero migration.

## 4. A repository pattern that paid for itself

The data layer started as one module branching across three backends in five
copy-pasted functions — a god-module that violated SRP/OCP/DRY. I refactored to a
single `FinanceStore` interface with a `DynamoStore` (constructor-injected
client) and a `MemoryStore`, chosen once by environment. Two payoffs:

- The previously **untested** production DynamoDB path got real coverage —
  dependency injection lets a unit test assert the exact `PutCommand`/`QueryCommand`
  shapes with no live AWS.
- Cutting a half-built Aurora path (YAGNI) shrank the module ~40%.

The lesson: a repository interface earns its keep only with ≥2 real
implementations. DynamoDB + an in-process demo store is exactly that.

## 5. CI/CD that owns the whole path

The pipeline isn't just tests. On every push it runs: gitleaks full-history
secret scan + dependency audit → typecheck + the test pyramid (86% line coverage)
+ production build → deterministic pipeline evidence → CodeQL SAST → a **live smoke
that hard-asserts `db_mode=aws-dynamodb`** and that intake/Q&A activity persists
through DynamoDB, with a search hard-gate. That smoke assertion means a deploy
that lost its env var gets *caught* instead of silently shipping demo mode — the
failure mode that would quietly invalidate the entire sponsor claim. And the
infrastructure is codified to match: the DynamoDB table and stream, the scoped
IAM, and a CQRS read-model on Amazon OpenSearch (fed by a DynamoDB-Streams →
Lambda projector) all live in **Terraform**, so the data tier provisions or tears
down with one command.

A war story from the deploy seam, because zero-stack still has seams: Vercel's
Git integration is *supposed* to auto-deploy on push to `main`. Mid-build it
started silently not picking up commits — the worst kind of failure, because
nothing errors and the live site just quietly lags `main`. Rather than fight the
integration under deadline, I added a one-button escape hatch: a manual
`deploy-prod.yml` (`workflow_dispatch`) that runs `vercel pull → vercel build
--prod → vercel deploy --prebuilt --prod` against the same `VERCEL_*` repo
secrets. The lesson: even on a stack with "nothing to manage," own a manual
deploy path so a flaky integration is an inconvenience, not an outage.

## The meta-lesson

"Zero stack" sounds like *less engineering*. It's the opposite: when the stack is
a front end and a database, there's nowhere to hide. The differentiator isn't
infrastructure — it's whether the numbers are correct, cited, reproducible, and
continuously verified. For anything that touches money, that *is* the product.

Live: https://h0-archon.vercel.app · ~2:55 demo: https://h0-archon.vercel.app/archon-h0-demo.mp4 · Code (MIT): https://github.com/upgradedev/h0-archon


---
*I created this content for the purposes of entering the H0: Hack the Zero Stack with Vercel v0 and AWS Databases hackathon. #H0Hackathon*
