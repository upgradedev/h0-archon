# H0 Submission Package

## Project

**Archon H0: Agentic Financial Intelligence for SMBs on Vercel + AWS**

Archon turns fragmented SMB finance files into a monthly CFO command center:
P&L, cash movement, sales performance, purchase concentration, payroll controls,
source citations, and ask-report Q&A. The public judge path is intentionally
ungated so judges can verify the Vercel app and AWS database evidence quickly.

## Links

- Live app: https://h0-archon.vercel.app
- Public repo: https://github.com/upgradedev/h0-archon
- Live report API: https://h0-archon.vercel.app/api/report
- Judge evidence API: https://h0-archon.vercel.app/api/evidence
- History and activity API: https://h0-archon.vercel.app/api/history
- CI workflow: https://github.com/upgradedev/h0-archon/actions/workflows/h0-archon-ci.yml

## What It Does

Archon runs a seven-step finance-close workflow:

1. Intake monthly finance files.
2. Classify bank, sales, purchase, payroll, and payslip documents.
3. Extract finance fields into normalized structures.
4. Link records into one monthly company event.
5. Validate cross-document controls.
6. Persist report and interaction activity to AWS DynamoDB.
7. Analyze the result into CFO-ready business intelligence.

The live sample exposes full SMB finance intelligence, not only payroll:

- Revenue: EUR 96,800
- EBITDA: EUR 20,889
- Sales goal attainment: 96.8%
- Closing cash: EUR 58,789
- Purchase concentration: fresh produce at 42.7% of COGS
- Payroll finding: bank-visible net salary transfer EUR 5,957 versus true
  employer payroll cost EUR 9,111
- Hidden monthly payroll understatement: EUR 3,154

## Sponsor Technology Evidence

- Frontend and API: Next.js App Router deployed on Vercel.
- AWS database: DynamoDB selected by `DYNAMODB_TABLE` in production.
- Data model: single-table records with `pk=REPORT` for finance reports and
  `pk=ACTIVITY` for intake/Q&A activity.
- Public proof:
  - `/api/report` returns `db_mode=aws-dynamodb`.
  - `/api/evidence` returns sponsor-stack proof and judging criteria mapping.
  - `/api/history` returns persisted report runs plus interaction activity.
- CI/CD: GitHub Actions runs install, typecheck, tests, production build,
  deterministic pipeline evidence, and live production smoke.

See `docs/DYNAMODB_PROOF.md` for the database model and verification commands.

## Judging Criteria Map

| Criterion | Evidence |
|---|---|
| Technological Implementation | Vercel-hosted Next.js app, Vercel Functions, AWS DynamoDB persistence, tests, CI, live smoke, public APIs |
| Design | Dense CFO dashboard with document intake, run ledger, P&L, cash, sales, purchases, citations, ask-report Q&A, history |
| Impact | Solves a real SMB problem: fragmented finance docs hide cash, sales, purchase, and payroll truths from owners |
| Originality | Agent-style document fusion with source-backed CFO analysis and auditable control checks |

## Demo Script

1. Open the live app.
2. Show the sidebar stack: Vercel + AWS DynamoDB.
3. Click **Run Finance Close**.
4. Show P&L, cash runway, sales goal attainment, purchase concentration, and
   payroll control finding.
5. Use Document Intake with bank, sales, purchases, and payroll filenames.
6. Ask: "What is the true payroll cost versus the bank statement?"
7. Open `/api/evidence` and `/api/history`.
8. Point out `db_mode=aws-dynamodb`, `records=REPORT+ACTIVITY`, citations, and
   persisted interaction activity.

## v0 Provenance Required

The implementation is Vercel + AWS ready. For final H0 submission, attach real
v0 evidence if available: v0 chat URL, prompt history screenshot, generated
branch/PR, or "Add to Codebase" command output. Do not claim v0 provenance
without a real artifact. See `docs/V0_USAGE.md`.

## Final Submission Checklist

- [ ] Production app opens at https://h0-archon.vercel.app.
- [ ] `npm run ci` passes locally.
- [ ] `npm run smoke:live` passes against production.
- [ ] GitHub Actions is green on the final commit.
- [ ] Devpost includes live URL, repo URL, and a 2-3 minute demo video.
- [ ] Devpost includes AWS DynamoDB proof.
- [ ] Devpost includes real v0 provenance artifact if available.
