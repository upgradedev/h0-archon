# Archon H0: Vercel + AWS

Live app: https://h0-archon.vercel.app  
Evidence CI: https://github.com/upgradedev/h0-archon/actions/workflows/h0-archon-ci.yml

Archon H0 is the fast Vercel + AWS challenge build of Archon. It presents an
SMB finance intelligence command center: P&L, account-statement movement, sales
performance versus goals, purchase concentration, and payroll controls. Payroll
is still an important finding, but it is one control inside the full monthly
finance close.

The current build is intentionally public and ungated for judges. Instead of
adding authentication friction, it adds judge-visible product depth: an agent
run ledger, document intake, source-backed citations, ask-report Q&A, scenario
planning, recent persisted run history, persisted intake/Q&A activity, and
dedicated evidence APIs.

## Stack

- Next.js app for Vercel
- AWS DynamoDB via `DYNAMODB_TABLE` for the fast serverless deployment path
- Optional AWS Aurora PostgreSQL fallback via `DATABASE_URL`
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

Fast H0 path:

```bash
DYNAMODB_TABLE=h0-archon-reports
AWS_REGION=eu-west-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

Aurora fallback:

Create an Aurora PostgreSQL database and set:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB
PGSSLMODE=require
```

Then run:

```bash
npm run db:seed
```

The schema lives in `db/schema.sql`.

## Judge Path

1. Open `https://h0-archon.vercel.app`.
2. Press **Run Finance Close**.
3. Confirm the dashboard shows:
   - document intake with bank/sales/purchases/payroll coverage
   - seven-agent run ledger
   - P&L revenue: EUR 96,800
   - EBITDA: EUR 20,889
   - sales goal attainment: 96.8%
   - closing cash: EUR 58,789
   - purchase concentration risk: fresh produce at 42.7% of COGS
   - bank confirmation: EUR 5,957
   - true employer cost: EUR 9,111
   - hidden wedge: EUR 3,154
   - employer IKA gap: 27.9%
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
