# H0 Live Evidence - 2026-06-28

> 🕘 Historical snapshot — figures below reflect the pre-ARCHON-DEMO data set and
> are superseded by the current canonical numbers (ARCHON DEMO IKE, Jan 2026) in
> `docs/ARCHITECTURE_AND_EVIDENCE.md` and `docs/DYNAMODB_PROOF.md`. Kept verbatim
> for the historical record; do not cite these numbers as current.

## Public Targets

- App: https://h0-archon.vercel.app
- API: https://h0-archon.vercel.app/api/report
- Repo: https://github.com/upgradedev/h0-archon
- CI workflow: https://github.com/upgradedev/h0-archon/actions/workflows/h0-archon-ci.yml
- Final production deployment verified in this pass:
  - Deployment: `dpl_8ATqvpEpEssdm7KtJrZvsbzbPVpP`
  - Deployment URL: https://h0-archon-jw0gmwo0p-reflectivegr.vercel.app
  - Production alias: https://h0-archon.vercel.app

## Confirmed Green CI

- Push run `28314932395`: success, includes finance scope expansion and live Vercel + AWS DynamoDB smoke.
- Push run `28312638726`: success, includes live Vercel + AWS DynamoDB smoke.
- Push run `28312523535`: success.
- Push run `28311936518`: success.
- Prior push run `28302687767`: success.
- Manual run `28302687749`: success.

## Live API Facts

Polled from `GET /api/report` on 2026-06-28 Europe/Athens after refreshing
production with `POST /api/run`.

- `db_mode`: `aws-dynamodb`
- `generated_at`: `2026-06-28T08:14:15.190Z`
- `analysis_engine`: deterministic-finance-engine
- P&L revenue: `96800`
- EBITDA: `20889.38`
- sales goal attainment: `96.8%`
- closing cash: `58789.38`
- fresh-produce purchase concentration: `42.68%`
- citations: `4`
- `/api/intake`: classifies the sample monthly close bundle as close-ready.
- `/api/ask`: `GET` returns a sample source-backed answer; `POST` answers true
  payroll cost versus bank statement with four sources and persists activity.
- `/api/history`: returns persisted `reports` and `activity` records from
  DynamoDB.
- `/api/evidence`: includes `records=REPORT+ACTIVITY`.
- `event.company`: `Eleftheria Foods AE`
- `event.period`: `2026-05`
- `event.employee_count`: `5`
- `event.bank_net_total`: `5956.67`
- `event.gross_total`: `7450.00`
- `event.employer_ika_total`: `1660.62`
- `event.employer_cost_total`: `9110.62`
- `event.hidden_total`: `3153.95`
- `event.cost_gap_pct`: `27.88`

## Validation Rules

- R1 passed: bank net transfer equals payslip net total.
- R2 passed: employer IKA ratio is 22.29%.
- R3 passed: payment date is present and consistent.
- R4 passed: employee count is consistent.

## Judge Read

The deployed app demonstrates the H0 requirement with a live Vercel frontend,
AWS DynamoDB persistence, deterministic finance analysis, API evidence, and a
CI gate covering install, typecheck, unit tests, production build, pipeline
execution, and live production smoke against the public DynamoDB-backed API.
The judge-visible surface now covers P&L, account statement movement, sales
performance versus goals, purchase concentration, payroll controls, document
intake, source-backed citations, ask-report Q&A, and persisted interaction
activity.

## Final Verification In This Pass

- `npm run ci`: passed locally.
- `npm run smoke:live`: passed against production.
- Live smoke activity IDs:
  - intake: `intake-20260628081435-draen36n`
  - ask: `ask-20260628081436-7t9tjrze`
- Production Vercel logs for the final deployment show 200s for `/`,
  `/api/report`, `/api/run`, `/api/intake`, `/api/ask`, and `/api/history`.
- Desktop screenshot: `docs/figures/h0-dashboard-production.png`
- Mobile screenshot: `docs/figures/h0-dashboard-mobile-production.png`
- Architecture figure: `docs/figures/h0-architecture.svg`
