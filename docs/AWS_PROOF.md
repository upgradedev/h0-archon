# AWS DynamoDB usage — proof

Live evidence that the deployed Archon H0 app uses **Amazon DynamoDB** as its
primary backend (the H0 mandatory AWS database). Captured 2026-06-28 from the
production account via the AWS API/CLI (SIGV4).

## `describe-table` — the production table

```
aws dynamodb describe-table --table-name h0-archon-reports --region eu-west-1
```

| Field | Value |
|---|---|
| Table name | **h0-archon-reports** |
| Status | **ACTIVE** |
| Partition key | **pk** (String, HASH) |
| Sort key | **sk** (String, RANGE) |
| Billing mode | **PAY_PER_REQUEST** (on-demand — scales to zero) |
| Item count | **41** |
| Region | **eu-west-1** |
| ARN | `arn:aws:dynamodb:eu-west-1:308857099262:table/h0-archon-reports` |
| AWS Account | `308857099262` (`aws sts get-caller-identity`) |

## `scan` — the single-table design in production

```
aws dynamodb scan --table-name h0-archon-reports --region eu-west-1 --max-items 50
```

- Scanned items: **43**
- Partition-key breakdown: **`REPORT` = 8**, **`ACTIVITY` = 35**

This is the deliberate single-table model: finance-close reports (`pk=REPORT`,
`sk=<ISO generated_at>#<event_id>`) and audit activity (`pk=ACTIVITY`,
`sk=<ISO created_at>#<activity_id>`) co-located for partition-key reads. Example
sort keys observed:

```
ACTIVITY | 2026-06-28T08:11:01.519Z#intake-20260628081101-ag0xs1xi
ACTIVITY | 2026-06-28T08:11:01.998Z#ask-20260628081101-xogkrppg
REPORT   | <ISO generated_at>#evt-...-2026-05
```

## Public runtime proof (no AWS access needed)

```
curl https://h0-archon.vercel.app/api/report     # -> "db_mode":"aws-dynamodb"
curl https://h0-archon.vercel.app/api/evidence   # -> records=REPORT+ACTIVITY
curl "https://h0-archon.vercel.app/api/history"   # -> persisted REPORT + ACTIVITY items
```

The deployed Vercel app reports `db_mode: "aws-dynamodb"` and serves the persisted
items above — confirming the Vercel front end reads/writes this exact DynamoDB
table. For the demo video, also show the **AWS Console → DynamoDB → Tables →
h0-archon-reports → Explore items** view (rows with `pk=REPORT` and `pk=ACTIVITY`).
