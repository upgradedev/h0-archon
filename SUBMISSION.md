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

1. Intake monthly finance files (PDFs/images).
2. Classify bank, sales, purchase, payroll, and payslip documents.
3. **Extract** finance fields from the raw documents with **AWS Bedrock vision
   (Claude Sonnet 4.6)** — measured at **96.7% field accuracy** on a labelled corpus.
4. Link records into one monthly company event.
5. Validate cross-document controls (a real register-vs-payslip cross-check).
6. Persist report and interaction activity to AWS DynamoDB.
7. Analyze with a **deterministic, auditable rules engine** into CFO-ready
   business intelligence.

Design in one line: **AI reads the documents (AWS Bedrock vision); deterministic
rules compute the books** — so extraction generalizes to messy real inputs while
every reported number stays auditable and reproducible.

The live sample exposes full SMB finance intelligence, not only payroll:

- Revenue: EUR 96,800
- EBITDA: EUR 20,889
- Sales goal attainment: 96.8%
- Closing cash: EUR 58,789
- Purchase concentration: fresh produce at 42.7% of COGS
- Payroll finding: bank-visible net salary transfer EUR 5,957 versus true
  employer payroll cost EUR 9,111
- Hidden monthly payroll understatement: EUR 3,154

## Measured results (eval harness)

- **Real extraction accuracy: 96.7% field-level, 100% document classification**
  (AWS Bedrock vision, Claude Sonnet 4.6) on a labelled synthetic Greek finance
  corpus — against a perfect-extraction ceiling of 100%. See `eval/LIVE_EXTRACTION.md`.
- **Impact, quantified:** naive bank-only bookkeeping understates true cost by
  **EUR 314k across the corpus (61.7% over the bank figure)** — the gap Archon recovers.
- Reproduce: `npm run eval` (harness + ground truth); baselines in `eval/BASELINE.md`.

## Sponsor Technology Evidence

- Frontend and API: Next.js App Router deployed on Vercel.
- **AI extraction: AWS Bedrock** (Claude Sonnet 4.6 vision) turns raw PDFs into
  structured data — sponsor-clean (Bedrock is AWS). The analysis layer stays a
  deterministic, auditable rules engine.
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
| Technological Implementation | Vercel Next.js + Functions, **AWS Bedrock vision extraction (96.7% measured)**, AWS DynamoDB single-table persistence, a labelled eval harness, repository-pattern data layer, tests, CI, live smoke, public APIs |
| Design | Dense CFO dashboard (document intake, run ledger, P&L, cash, sales, purchases, citations, ask-report Q&A, history); clean "AI reads → deterministic rules compute" split |
| Impact | Solves a real SMB problem, **quantified**: bank-only bookkeeping understates true cost by **EUR 314k / 61.7%** across the eval corpus — Archon recovers it, with source citations and auditable controls |
| Originality | Verification-gated document fusion — AWS Bedrock vision proposes; a deterministic engine + cross-document rules (real register-vs-payslip check) verify; every number is auditable |

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
