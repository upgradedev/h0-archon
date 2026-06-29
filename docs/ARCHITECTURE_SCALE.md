# Scale architecture — DynamoDB primary + OpenSearch CQRS read-model

A deliberate data-tier design: **DynamoDB is the right primary for the access
patterns we actually have**, and a clean **CQRS** split projects a read model into
**Amazon OpenSearch** — already live for documents-first **search**, and the same
seam scales out to analytics — without ever changing the source of truth.

## Why DynamoDB is the deliberate primary (not Aurora)

Every read in the product is a **key-based, sorted access pattern**, not an ad-hoc
relational query:

| Need | Access pattern | DynamoDB primitive |
|---|---|---|
| Latest monthly close | `pk = REPORT`, newest first | `Query`, `ScanIndexForward:false`, `Limit:1` |
| Recent closes (history) | `pk = REPORT`, descending | `Query` |
| Recent activity (intake/Q&A) | `pk = ACTIVITY`, descending | `Query` |

Single-table design (`pk`/`sk`), **on-demand billing (scale-to-zero)**, single-digit-ms
reads, and — critically for **stateless Vercel Functions** — **no connection pool
and no cold-start pool exhaustion**. The financial analysis is computed in a
deterministic rules engine in code, so we do **not** need relational joins or SQL
aggregation as the primary path. Aurora would add Serverless-v2 cold-start and
pooling concerns for relational power this workload doesn't use. DynamoDB is the
intentional fit, and it scales horizontally by partition key (the table already
has a clean multi-tenant evolution: `TENANT#<id>#REPORT`).

## CQRS with OpenSearch as the read model (live today)

There are needs that are **deliberately NOT DynamoDB's job**: full-text **search**
(shipped now) and ad-hoc **analytics** (the scale-out). The clean answer is CQRS —
keep DynamoDB as the write side / source of truth, and project a query-optimized
read model into **Amazon OpenSearch**. This is live in the app today: search is
documents-first and returns individual documents with their number and date
(e.g. `AR-HA-003-001 · Sales invoice · 2026-01-22 · Hotel Aegeon · €3,304 · paid`),
while the aggregated close and Q&A logs are kept out of the index. The same seam
carries the analytics scale-out below.

```
            write (command side)                 read (query side)
  Vercel Functions ──Put──▶ DynamoDB ──Streams──▶ Lambda ──index──▶ OpenSearch
        (close, intake, Q&A)   (truth)   (CDC)     (projector)   (search + analytics)
```

- **DynamoDB Streams** emit every REPORT/ACTIVITY change (change-data-capture).
- A small **stream-processor Lambda** projects/denormalizes those events into
  OpenSearch indices (documents, line-items, transactions, closes).
- Read-only **search/analytics** APIs query OpenSearch; the write path and the
  source of truth are untouched (eventual consistency on the read side is fine for
  search/reporting).

### What OpenSearch unlocks (that DynamoDB shouldn't do)
- **Full-text search** across documents, vendors/counterparties, and line-items
  ("every invoice from vendor X", "all transactions mentioning 'overtime'") — **live
  today**.
- **Analytics & aggregations** over historical closes — spend trends, margin
  drift, cohort/period comparisons, supplier-concentration over time.
- **Anomaly / outlier detection** on transactions and ratios (e.g. an employer-IKA
  ratio outside the statutory band across the whole tenant history).
- Faceted filtering and dashboards over large volumes.

## Why this is the *deliberate* design, not a bolt-on
The point of CQRS here is **separation of concerns**: DynamoDB is optimal for the
transactional write path and key reads; OpenSearch is optimal for search and
analytics. Forcing search/analytics onto DynamoDB (scans, GSIs-for-everything) or
swapping the whole tier to Aurora would each be the *wrong* tool for half the job.
DynamoDB is the primary because that's what the transactional access patterns
need; the OpenSearch read-model is already live for search, and its analytics
surface grows as the data volume justifies it — driven by a need, not added for
show.
