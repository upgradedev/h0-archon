# AWS DynamoDB Proof

## Production Mode

The production deployment uses AWS DynamoDB when `DYNAMODB_TABLE` or
`AWS_DYNAMODB_TABLE` is present. The live H0 deployment currently reports:

```text
db_mode=aws-dynamodb
analysis_engine=deterministic-finance-engine
```

Verify publicly:

```bash
curl https://h0-archon.vercel.app/api/report
curl https://h0-archon.vercel.app/api/evidence
curl "https://h0-archon.vercel.app/api/history?limit=3&activity_limit=10"
```

Or run the automated smoke:

```bash
npm run smoke:live
```

## Single-Table Record Model

The table stores reports and user-facing audit activity with the same primary
key structure:

| Record | `pk` | `sk` | Payload |
|---|---|---|---|
| Finance close report | `REPORT` | ISO `generated_at#event_id` | `report`, `event_id`, `created_at` |
| Intake or Q&A activity | `ACTIVITY` | ISO `created_at#activity_id` | `activity`, `kind`, `summary`, `created_at` |

This lets the app fetch:

- latest report: query `pk=REPORT`, descending `sk`, `Limit=1`
- recent report history: query `pk=REPORT`, descending `sk`
- recent product activity: query `pk=ACTIVITY`, descending `sk`

## Why DynamoDB Fits H0

- Vercel Functions stay stateless; all durable report and activity state lives
  in AWS.
- Writes are small, append-oriented, and naturally partitioned by record type.
- Latest-report and recent-history queries are direct partition-key reads.
- No server-managed connection pool is required for the fast serverless path.
- The same table can later add tenant keys, for example
  `TENANT#<tenant_id>#REPORT` and `TENANT#<tenant_id>#ACTIVITY`.

## Public Evidence Fields

`/api/evidence` returns these proof markers:

```text
db_mode=aws-dynamodb
records=REPORT+ACTIVITY
citations=4
revenue=47200.00
ebitda=30697.55
sales_attainment=101.50
payroll_gap=2935.26
```

`/api/history` now returns both:

- `reports`: persisted finance close reports
- `activity`: persisted intake and ask-report records

## Local Reproduction

Without AWS credentials the same code path falls back to embedded demo mode so
CI and reviewers can reproduce deterministic behavior:

```bash
npm ci
npm run ci
```

With AWS credentials:

```bash
set DYNAMODB_TABLE=h0-archon-reports
set AWS_REGION=eu-west-1
npm run pipeline
npm run dev
```
