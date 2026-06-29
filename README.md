# Archon H0: Vercel + AWS

Live app: https://h0-archon.vercel.app  
Evidence CI: https://github.com/upgradedev/h0-archon/actions/workflows/h0-archon-ci.yml

Archon H0 is the fast Vercel + AWS challenge build of Archon. Archon is a
**document-collection and auto-correlation engine**: it gathers every document a
business receives — purchases, sales, payments, receipts, payroll — links the
related ones into single financial events, and tells you whether your books are
**complete and reconciled**. On top of that it presents an SMB finance command
center: P&L, account-statement movement, sales performance versus goals,
purchase concentration, and payroll controls. The payroll example — where the
true employer cost (€6,930) is only visible once the register is correlated with
the bank transfer (€3,994.74) — is one illustration of the correlation, not a
"gotcha": it is the ordinary employer-IKA-and-tax wedge that a single-document
view never records.

> *"We ran Archon on our own books at Reflective IKE — it pulled together the bank, payroll and invoices and told us in seconds that everything reconciled. That used to take our accountant the better part of a day."* — Founder, Reflective IKE

**Auth posture — demonstrated, not gatekeeping.** GitHub OAuth (NextAuth v5) is a
real, working capability: you can sign in, a session is issued and verified, and
your identity shows in the header. But sign-in is *offered, never required* — the
demo routes are intentionally left open so a reviewer can explore the entire
financial-intelligence experience without a login wall. Enforcement is one edit
away (`ENFORCE_PAGES` / `ENFORCE_APIS` in `middleware.ts`); the redirect/401 path
is present and exercised — we keep it empty on the hosted demo on purpose. So the
build stays public for judges *and* adds depth: an agent run ledger, document
intake, source-backed citations, ask-report Q&A, multi-period trends, recent
persisted run history, and dedicated evidence APIs.

## Stack

- Next.js app for Vercel
- AWS DynamoDB via `DYNAMODB_TABLE` for the serverless deployment path
- Deterministic CFO rules engine running in Vercel Functions
- Document-intake and ask-report Vercel Functions
- Single-table `REPORT` and `ACTIVITY` records for reports, intake, and Q&A
- Embedded demo mode when no AWS database is configured

## Run

```bash
npm install
npm run build
npm run pipeline
npm run dev
```

Open `http://localhost:3000`.

## AWS Database

Set the DynamoDB table and AWS credentials, then the app persists every
finance-close report and audit-activity record to AWS DynamoDB:

```bash
DYNAMODB_TABLE=h0-archon-reports
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Seed one report into the active store:

```bash
npm run db:seed
```

With no AWS env vars set, the app runs in an in-process demo store so the full
pipeline and dashboard work locally with no database.

## Pages

- `/` — marketing landing (the value prop, completeness/correlation hook, features, stack).
- `/dashboard` — the full finance-close command center (the product).
- `/extract` — live document extraction: pick a sample PDF, watch AWS Bedrock
  vision read it, and see field accuracy scored against ground truth. Degrades
  gracefully to a cached example when `BEDROCK_*` / AWS creds are not configured.

A shared top nav links Home / Dashboard / Live Extract on every page.

## Judge Path

1. Open `https://h0-archon.vercel.app` (landing), then click **Open the
   dashboard** — or go straight to `https://h0-archon.vercel.app/dashboard`.
2. Press **Run Finance Close**.
3. Confirm the dashboard shows:
   - document intake with bank/sales/purchases/payroll coverage
   - eight-agent run ledger
   - P&L revenue: EUR 47,200
   - EBITDA: EUR 30,698 (65% margin)
   - sales goal attainment: 101.5%
   - closing cash: EUR 79,498
   - supplier concentration watch: AI-model spend at 28% of COGS
   - bank confirmation: EUR 3,994.74
   - true employer cost: EUR 6,930
   - correlation wedge (only visible once correlated): EUR 2,935.26
   - employer IKA: 35.8% of net
   - source-backed citations and Ask Archon answer panel
4. Open `https://h0-archon.vercel.app/api/report` to verify the JSON API and
   persistence mode. The live deployment should report `db_mode:
   "aws-dynamodb"`.
5. Open `/api/intake`, `/api/ask`, `/api/history`, and `/api/evidence` for
   intake classification, conversational answers, persisted run and activity
   history, and sponsor-stack evidence.

## Evidence

- Public repo: https://github.com/upgradedev/h0-archon
- Public app: https://h0-archon.vercel.app
- Live API: https://h0-archon.vercel.app/api/report
- Intake API: https://h0-archon.vercel.app/api/intake
- Ask API: https://h0-archon.vercel.app/api/ask
- Run history API: https://h0-archon.vercel.app/api/history
- Judge evidence API: https://h0-archon.vercel.app/api/evidence
- Submission package: `SUBMISSION.md`
- AWS DynamoDB proof: `docs/DYNAMODB_PROOF.md`
- Data-tier design + scale path (DynamoDB → CQRS + OpenSearch): `docs/ARCHITECTURE_SCALE.md`
- v0 provenance checklist: `docs/V0_USAGE.md`
- Architecture figure: `docs/figures/h0-architecture.svg`
- CI gate: `npm ci`, TypeScript, unit tests, production build, pipeline JSON
  evidence artifact, and live Vercel + AWS DynamoDB smoke covering report,
  intake activity, ask activity, and history.
- Check the Actions link above for the latest final-run status. Prior green
  examples include push runs `28314932395`, `28312638726`, `28312523535`,
  `28311936518`, `28302687767`, and manual run `28302687749`.
- Latest evidence note: `docs/LIVE_EVIDENCE_2026-06-28.md`
- Video gap review: `docs/V0_VIDEO_GAP_REVIEW.md`
