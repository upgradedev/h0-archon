# The €3,154 your bank statement hides every month: building Archon on the Vercel + AWS "zero stack"

*A build log for the H0: Hack the Zero Stack hackathon — Next.js on Vercel, AWS DynamoDB on the back, AWS Bedrock vision reading the documents, and a deterministic CFO engine keeping every number auditable.*

## The problem nobody told the small-business owner about

Ask a small-business owner in Greece what payroll costs them, and they will tell you the number on their bank statement: the net salary batch their bank transferred to employees. For our sample company, **Eleftheria Foods AE**, that number is **€5,956.67** for May 2026.

That number is wrong. Not by a rounding error — by **27.88%**.

The bank confirmation only shows the *net cash that left the account*. It does not show employee tax withheld, employee social-security (IKA) contributions, or — the big one — the **employer's** IKA contribution, which in Greece runs at about **22.29% of gross** and never appears on the salary-transfer line at all. Stack those back on and the true monthly cost to the company is **€9,110.62**. The bank statement hides **€3,153.95 every single month** — roughly €38,000 a year of real cost that naive bookkeeping silently drops on the floor.

This is not an exotic edge case. It is the default way a small business misreads its own payroll, because the truth is split across three documents that nobody ever reconciles:

1. **The bank confirmation** — net cash transferred (understates everything).
2. **The payroll register** — gross, taxes, employee IKA, *employer* IKA, true cost.
3. **The individual payslips** — the per-employee breakdown.

Archon's job is to fuse those three views into one accurate financial event, then build a CFO-grade monthly close on top of it. For H0, the question was: *how little stack do you need to ship that as a real product?*

## The "zero stack": v0/Vercel on the front, AWS databases on the back

The H0 premise is that you can build a production-shaped full-stack app with almost no infrastructure: a Vercel front end and one managed AWS database, nothing to provision, nothing to babysit. We took that literally.

- **Front end + API:** a single Next.js 16 App Router project deployed on Vercel. The UI is a React 19 client component; every API route (`/api/report`, `/api/intake`, `/api/ask`, `/api/evidence`, `/api/history`, `/api/run`) is a Vercel Function.
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

Here is the decision I expect to get questions about: **a vision model reads the documents, but no model decides your numbers.** Extraction uses **AWS Bedrock vision (Claude Sonnet 4.6)** to turn messy PDFs into structured fields — measured at **96.7% field accuracy** against a labelled corpus. But the CFO analysis — P&L, EBITDA, cash movement, sales-vs-goal, purchase concentration, and the payroll-truth finding — runs on a **deterministic finance rules engine**, not a model. *AI reads; deterministic rules compute.*

That is a feature, not a shortcut. A finance-close tool that gives a *different* answer each time you run it is worse than useless; it is a liability. Determinism means:

- **Auditability.** Every number traces to a source document and a rule. The app emits source citations for its claims.
- **Reproducibility.** A judge — or an auditor — can run `npm run ci` with no cloud credentials and get the exact same figures, because the engine falls back to an in-process store in demo mode.
- **Trust.** The four cross-document validation rules either pass or they don't:
  - **R1** — bank net transfer ≈ sum of payslip net pay (±2%). *Pass: €5,956.67 vs €5,956.67.*
  - **R2** — employer IKA ratio within the Greek statutory band. *Pass: 22.29% of gross.*
  - **R3** — payment date present and consistent across documents.
  - **R4** — employee count consistent between register and payslips.

If those four checks pass, the fused event is trustworthy. If one fails, you know exactly which document disagrees. That is the part a language model cannot give you.

## What the judge (and the owner) actually sees

The dashboard is intentionally dense — a work surface, not a landing page. The first viewport carries the whole monthly close: P&L revenue **€96,800**, EBITDA **€20,889**, sales-goal attainment **96.8%**, closing cash **€58,789**, a purchase-concentration risk flag (fresh produce at **42.7%** of COGS), and the payroll-truth finding front and center. There is a seven-step agent run ledger (intake → classify → extract → link → validate → report → analyze), an "Ask Archon" panel that answers questions like *"What is the true payroll cost versus the bank statement?"* with cited sources, and a persisted activity trail backed by DynamoDB.

## What "production in minutes" really bought us

The honest scorecard of the zero stack:

- **Time-to-live** was dominated by writing product logic, not wiring infrastructure. The database was a table definition and four IAM actions (`PutItem`, `Query`, scoped to one ARN).
- **Cost at demo scale is effectively zero** — two partitions, tiny items, DynamoDB on-demand billing, Vercel's serverless tier.
- **The resilience story is real:** DynamoDB → Aurora PostgreSQL fallback → embedded-demo, chosen at runtime by which environment variables are present. The same code runs on a judge's laptop with no AWS account and in production against a real table.
- **CI is a full pyramid:** typecheck, unit tests for the pipeline / data layer / insights model, a production build, a deterministic pipeline run, and a live smoke test against the deployed Vercel + DynamoDB endpoints.

The lesson H0 is really teaching: when the stack collapses to "a front end and a database," the thing that differentiates a demo from a product isn't the infrastructure — it's whether your numbers are *correct, cited, and reproducible*. For a finance tool, that is the entire game.

---

*Archon H0 is live at https://h0-archon.vercel.app and open-source at https://github.com/upgradedev/h0-archon. The architecture diagram, AWS DynamoDB proof, and full submission package are in the repo's `docs/` directory.*


---
*I created this content for the purposes of entering the H0: Hack the Zero Stack with Vercel v0 and AWS Databases hackathon. #H0Hackathon*
