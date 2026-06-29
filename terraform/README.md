# Archon H0 — Infrastructure as Code (Terraform)

Terraform for the AWS data tier that realizes the CQRS read-model design in
[`../docs/ARCHITECTURE_SCALE.md`](../docs/ARCHITECTURE_SCALE.md): DynamoDB stays
the write-side source of truth, and a DynamoDB Streams -> Lambda -> OpenSearch
pipeline projects a query-optimized read model for search and analytics.

```
  Vercel Functions ──Put──▶ DynamoDB ──Streams──▶ archon-indexer ──index──▶ OpenSearch
        (write side)         (truth)     (CDC)       (Lambda)            (read model)
```

Account `308857099262`, region `eu-west-1`.

## What this provisions

| File | Resources |
|---|---|
| `versions.tf` | Terraform >= 1.5, `aws` ~> 5.0, `archive` ~> 2.4 |
| `providers.tf` | AWS provider + `default_tags` (`Project=archon-h0`, `ManagedBy=terraform`) |
| `variables.tf` | region, account_id, project, table + domain + Bedrock settings |
| `dynamodb.tf` | `h0-archon-reports` table (pk/sk, PAY_PER_REQUEST, **Streams NEW_AND_OLD_IMAGES**, optional PITR) |
| `opensearch.tf` | `archon-search` domain (1× t3.small.search, gp3 10 GB, full encryption, HTTPS/TLS 1.2, account-root access policy) |
| `iam.tf` | (a) app/Vercel policy: DynamoDB R/W + Bedrock invoke + OpenSearch query; (b) indexer Lambda role + policy |
| `lambda.tf` | `archon-indexer` Lambda (nodejs20.x) + event source mapping from the table stream |
| `lambda/index.mjs` | the stream processor (SigV4-signed OpenSearch indexing) |
| `outputs.tf` | table name/arn/stream, domain endpoint/arn, lambda name, role/policy ARNs |

## Cost note

The OpenSearch domain is the one always-on cost here: a single `t3.small.search`
node with 10 GB gp3 runs **~$26/month** (≈$0.036/hr instance + EBS). DynamoDB is
on-demand (pay-per-request, scales to zero), the Lambda is invoked only on
change events, and Streams are free within the read quota — so the read-model
pipeline adds effectively nothing until OpenSearch is provisioned. Destroy the
domain when search/analytics aren't being demoed to drop the bill to ~$0.

## Usage

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

The Lambda zip is built in-tree by the `archive_file` data source — no external
build step. The zip contains only `index.mjs` + `package.json`; every dependency
the handler imports (`@aws-sdk/*`, `@aws-crypto/sha256-js`) is provided by the
**nodejs20.x managed runtime**, so there is no `node_modules` to vendor. If a
future runtime stops bundling the SDK, run `npm install` inside `lambda/` before
`apply` so the modules get zipped.

## Adopting the already-created resources (`terraform import`)

The DynamoDB table and the OpenSearch domain **already exist** in AWS (created
out-of-band). Import them into state before the first `apply`, otherwise
Terraform will try to create duplicates and fail on name conflict. Everything
else in this stack (IAM policy/role, Lambda, event source mapping) is new and is
created by `apply`.

```bash
cd terraform
terraform init

# 1. Adopt the existing DynamoDB table
terraform import aws_dynamodb_table.reports h0-archon-reports

# 2. Adopt the existing OpenSearch domain
terraform import aws_opensearch_domain.archon_search archon-search

# 3. See what apply would change on the imported resources
terraform plan
```

### Expected plan drift after import (intentional)

- **DynamoDB Streams** — the live table currently has Streams **OFF**. This IaC
  sets `stream_enabled = true` / `NEW_AND_OLD_IMAGES` (required to feed the
  indexer). The post-import `plan` will show Streams being **turned on**; apply
  it to enable the CQRS pipeline. (Enabling Streams is a non-destructive table
  update.)
- **Point-in-time recovery** — `describe-table` does not report PITR state, so we
  assume the default (**disabled**) and leave `enable_point_in_time_recovery =
  false`. Flip the variable to `true` for production; this is not a captured
  mismatch, just a default.

If `plan` shows **no other changes** on the two imported resources, the HCL
matches live. Two fields to watch (pinned in the HCL to avoid false drift):
gp3 `iops=3000`/`throughput=125`, and the two `advanced_options`. At-rest
encryption uses the AWS-managed `aws/es` key by default (`kms_key_id` omitted),
which matches live — if `plan` ever shows `kms_key_id` drift, pin it to the
captured key ARN.

## Notes / known discrepancies

- **Bedrock model id**: this IaC defaults the IAM policy to the **EU** inference
  profile `eu.anthropic.claude-sonnet-4-6` (region is eu-west-1). The app code
  (`lib/extraction/bedrock.ts`) currently defaults `BEDROCK_MODEL_ID` to the
  **US** profile `us.anthropic.claude-sonnet-4-6`. Align them (set
  `BEDROCK_MODEL_ID=eu.anthropic.claude-sonnet-4-6` in the app, or override
  `var.bedrock_inference_profile_id`) so the granted resource matches what is
  actually invoked.
- The OpenSearch domain is **public** (no `vpc_options`) with an account-root
  access policy, matching live. Lock it down (VPC + fine-grained access) before
  any non-demo use.
