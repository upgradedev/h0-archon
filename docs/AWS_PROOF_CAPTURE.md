# Capturing the mandatory "AWS database usage" proof

Devpost requires a screenshot/proof that the app uses an AWS database. The most
convincing proof pairs a **console screenshot** with **CLI output** showing the
*same* data the live app serves. Capture both. Replace `h0-archon-reports` /
`eu-west-1` with the actual deployed table name and region.

## 1. Console screenshots (visual, for the video + Devpost gallery)

1. **DynamoDB → Tables → `<table>` → Explore table items.** THE screenshot.
   Show rows where `pk = REPORT` *and* `pk = ACTIVITY` together, with the ISO
   `sk` timestamps. Do not filter to one type — the side-by-side proves the
   single-table design.
2. **DynamoDB → Tables → `<table>` → Overview / General information.** Shows the
   partition key `pk (String)`, sort key `sk (String)`, capacity mode
   (On-demand), item count, region, and the table ARN — proving the schema
   matches `lib/db.ts`.
3. **DynamoDB → Tables → `<table>` → Monitoring.** Show non-zero
   `ConsumedWriteCapacityUnits` / successful-request graphs in the demo window —
   proves the table is *live*, not a placeholder.
4. **Expand one `pk = REPORT` item** so the nested `report` payload is visible
   (revenue, EBITDA, payroll gap) and matches `/api/evidence`.

## 2. CLI proof (durable text, paste into the submission)

```bash
# Which real AWS account this is
aws sts get-caller-identity

# Schema + status proof: KeySchema (pk HASH, sk RANGE), billing mode, item count, ARN
aws dynamodb describe-table \
  --table-name h0-archon-reports --region eu-west-1 \
  --query "Table.{Name:TableName,Status:TableStatus,Keys:KeySchema,Billing:BillingModeSummary,Items:ItemCount,Arn:TableArn}"

# Content proof: real REPORT + ACTIVITY items
aws dynamodb scan --table-name h0-archon-reports --region eu-west-1 --max-items 10

# BEST proof — run the exact query getLatestReport() runs (latest REPORT, desc sk, limit 1)
# PowerShell-safe: put the value in a file to avoid quoting issues.
#   '{":p":{"S":"REPORT"}}' > kv.json
aws dynamodb query \
  --table-name h0-archon-reports --region eu-west-1 \
  --key-condition-expression "pk = :p" \
  --expression-attribute-values file://kv.json \
  --no-scan-index-forward --max-items 1
```

## 3. The closing argument (most persuasive single artifact)

Put these two side by side in the writeup:
- the `scan`/`query` output above showing the stored `report` payload, and
- `curl https://h0-archon.vercel.app/api/evidence` showing `db_mode=aws-dynamodb`
  with the **same** `revenue` / `ebitda` / `payroll_gap` numbers.

Identical numbers on both sides = irrefutable proof the deployed Vercel app reads
and writes this exact DynamoDB table.

## Pre-check (one command)

```bash
curl https://h0-archon.vercel.app/api/evidence
```

If `db_mode` is not `aws-dynamodb`, the live deployment is missing
`DYNAMODB_TABLE` and is in embedded-demo mode — fix the Vercel env var before
capturing proof.
