# Archon on AWS: the AI reads, a deterministic engine does the math

*How I built an SMB finance-close engine on the "zero stack" — Next.js on Vercel, with Amazon DynamoDB, Amazon Bedrock, and Amazon OpenSearch doing the real work on the back end.*

**Try it live:** https://h0-archon.vercel.app · **Code (MIT):** https://github.com/upgradedev/h0-archon

> *I built Archon and wrote this for the **H0 Hackathon** (Hack the Zero Stack — Vercel + AWS). #H0Hackathon*

---

## The problem

Every month a small business closes its books. The truth of that month is scattered across documents that don't talk to each other: a bank statement, a payroll register, individual payslips, supplier invoices, receipts. Each one tells part of the story. To get the real picture you correlate them by hand — every month.

The trap I kept hitting in real books: a single payroll event produces three documents, and they disagree on purpose. The bank confirmation shows the **net** that left the account (€3,994.74). The payroll register holds the **true employer cost** — gross pay plus employer social-security contributions (€6,930). The €2,935 difference — Greece's IKA plus withheld tax — is invisible *until you correlate the register with the bank transfer*. That's not a scandal; it's just what bank-only accounting can't see.

Archon ingests the month's documents and produces a boardroom-ready P&L, and tells you the one thing that matters: **are your books complete and reconciled, or are you missing a document?**

## The design principle: AI reads, deterministic code computes

The single most important architectural decision: **an LLM never touches a number.**

- **Amazon Bedrock** (Claude Sonnet 4.6) *reads* each document — vision extraction that turns a messy, real-world PDF into structured fields. Measured field accuracy on a labelled corpus: ~96.7%.
- A **deterministic finance engine** then does the math — fuse the documents into one event, run cross-document validation, compute every canonical figure with plain accounting rules.

This split is what makes the close *auditable*: the same inputs always produce the same books, every figure traces back to a source document, and no number is ever "hallucinated." The AI is confined to the one job it's genuinely good at — reading — and kept out of the one job where you can't tolerate non-determinism — the arithmetic.

## Amazon DynamoDB — single-table, source of truth

DynamoDB is the system of record. A single-table design holds two item types:

- `REPORT` — a persisted monthly close. Partition key `REPORT`, sort key `<generated_at>#<event_id>` so closes sort newest-first and never collide.
- `ACTIVITY` — the product event trail (intake, Q&A, runs) for an auditable history.

Why single-table DynamoDB and not a relational DB? The access patterns are simple and known — "latest report," "reports over time," "recent activity" — and they map cleanly to partition+sort key queries with single-digit-millisecond reads, no connection pool to babysit, and per-request pricing that's effectively free at demo scale. I deliberately did **not** reach for Aurora: there's no relational join in the hot path, and a serverless front (Vercel Functions) pairs better with a serverless, connectionless datastore.

## Amazon Bedrock — vision extraction

Each uploaded document is sent to Bedrock as a Converse `document` block (PDF-direct, no rasterization step) and comes back as structured JSON: counterparty, dates, amounts, line items, document type. The same extraction path powers both the curated-sample demo and the live upload, so what you see in the demo is the real pipeline. Bedrock keeps this entirely inside AWS — no third-party model endpoint, IAM-scoped to a single `bedrock:InvokeModel` permission.

## Amazon OpenSearch — a CQRS read-model for search

DynamoDB is the write side (the truth). For *finding* things, I added Amazon OpenSearch as a **CQRS read-model**, fed from DynamoDB. This is a deliberate separation: OpenSearch never computes a KPI or a canonical number — it only powers exploration.

The search is **documents-first**. Type "hotel" and you get the actual invoices — `AR-HA-003-001 · Sales invoice · 2026-01-22 · Hotel Aegeon · €3,304 · paid` — each with its **document number and date**, not just a rolled-up vendor total. The aggregated close and the Q&A logs are deliberately kept *out* of the index so they don't drown the source documents you're actually looking for. A folding analyzer (lowercase + Greek lowercase + ASCII-folding) means Greek and Latin queries both hit.

## Putting it together

```
Browser (React 19)
   │ HTTPS
Vercel  ── Next.js 16 (SSR + CDN)
        └─ Vercel Functions /api ── deterministic finance engine
                  │ read/write close        │ upload: read document      │ search
                  ▼                          ▼                            ▼
            Amazon DynamoDB ──CQRS feed──▶ Amazon OpenSearch     Amazon Bedrock
            (source of truth)             (documents-first)      (vision extraction)
```

Drop a document on the dashboard's eight-agent run ledger and you watch it happen live: the Extractor reads it with Bedrock, the engine links and validates it, the close recomputes, and the affected tiles flash and update — a per-session "what-if" that never overwrites the shared demo.

## What I'd tell another builder

- **Let the LLM read, never compute.** It's the cleanest way to get AI leverage without giving up auditability.
- **Single-table DynamoDB is liberating** when your access patterns are known — no schema migrations, no pool, no idle cost.
- **CQRS with OpenSearch** keeps your search rich without ever risking your source-of-truth numbers.
- The whole back end is Terraform'd and the pipeline (typecheck/test/build + gitleaks + CodeQL + a live smoke that hard-asserts `db_mode=aws-dynamodb`) gates every change.

**Try it:** https://h0-archon.vercel.app — drop a document and watch the books reconcile.
