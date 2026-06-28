# H0 Live Evidence - 2026-06-28

## Public Targets

- App: https://h0-archon.vercel.app
- API: https://h0-archon.vercel.app/api/report
- Repo: https://github.com/upgradedev/h0-archon
- CI workflow: https://github.com/upgradedev/h0-archon/actions/workflows/h0-archon-ci.yml

## Confirmed Green CI

- Push run `28312638726`: success, includes live Vercel + AWS DynamoDB smoke.
- Push run `28312523535`: success.
- Push run `28311936518`: success.
- Prior push run `28302687767`: success.
- Manual run `28302687749`: success.

## Live API Facts

Polled from `GET /api/report` on 2026-06-28 Europe/Athens.

- `db_mode`: `aws-dynamodb`
- `generated_at`: `2026-06-27T21:17:05.859Z`
- `analysis_engine`: deterministic-finance-engine
- P&L revenue: `96800`
- sales goal attainment: `96.8%`
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
AWS DynamoDB persistence, deterministic reconciliation rules, API evidence, and
a CI gate covering install, typecheck, unit tests, production build, pipeline
execution, and live production smoke against the public DynamoDB-backed API.
