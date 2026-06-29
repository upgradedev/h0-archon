# Dev-log — Five engineering decisions behind Archon on the Vercel + AWS zero stack

> Bonus content piece 3 of 3. Technical "how I built it" companion to the main
> blog — engineering-decisions angle, distinct from the product story. Publish to
> dev.to / Hashnode / Medium. ~700 words.

The main write-up covers *what* Archon does (fuses small-business finance
documents into an auditable monthly close, and surfaces the ~28% of payroll cost
that the bank statement hides). This one is for engineers: the five decisions
that made it clean rather than just working.

## 1. AI reads the documents; deterministic rules decide the numbers

The obvious build for a "financial intelligence" app is to let one model read the
documents *and* emit the numbers. I split it. A **vision model — AWS Bedrock,
Claude Sonnet 4.6 — reads** the messy PDFs into structured fields (measured at
**96.7% field accuracy** against a labelled corpus). But the P&L, cash, sales,
purchase-concentration, and payroll-truth **math runs in a deterministic rules
engine**, not a model — because a finance-close tool that returns a *different*
answer each run is a liability, not a feature. Three properties fall out of the
deterministic decision layer for free:

- **Auditability** — every figure traces to a source document and a rule, and the
  app emits citations for its claims.
- **Reproducibility** — `npm run ci` produces identical numbers with no cloud
  credentials, because the data layer falls back to an in-process store.
- **Trust** — four cross-document checks (bank-net ≈ payslip-net, employer-IKA in
  the Greek statutory band, payment-date consistency, headcount consistency)
  either pass or name the document that disagrees.

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
secret scan + dependency audit → typecheck + the test pyramid + production build →
deterministic pipeline evidence → **automated Vercel deploy** (gated on secrets,
skips cleanly without them) → **post-deploy live smoke that hard-asserts
`db_mode=aws-dynamodb`** and that intake/Q&A activity persists through DynamoDB.
That last assertion means a deploy that lost its env var *fails* instead of
silently shipping demo mode — the failure mode that would quietly invalidate the
entire sponsor claim.

## The meta-lesson

"Zero stack" sounds like *less engineering*. It's the opposite: when the stack is
a front end and a database, there's nowhere to hide. The differentiator isn't
infrastructure — it's whether the numbers are correct, cited, reproducible, and
continuously verified. For anything that touches money, that *is* the product.

Live: https://h0-archon.vercel.app · Code (MIT): https://github.com/upgradedev/h0-archon


---
*I created this content for the purposes of entering the H0: Hack the Zero Stack with Vercel v0 and AWS Databases hackathon. #H0Hackathon*
