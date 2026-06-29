# DynamoDB — the CQRS write side / source of truth.
#
# Single-table design (pk/sk) matching lib/store.ts:
#   pk = "REPORT"   sk = "<generated_at>#<event_id>"   (monthly P&L closes)
#   pk = "ACTIVITY" sk = "<created_at>#<activity_id>"   (intake / Q&A audit trail)
#
# On-demand (PAY_PER_REQUEST) billing = scale-to-zero, no provisioned capacity to
# tune, and no connection pool — the right fit for stateless Vercel Functions.
#
# Streams are ENABLED here (NEW_AND_OLD_IMAGES) to drive the CQRS read-model
# projection: every REPORT/ACTIVITY change is emitted as a CDC event that the
# archon-indexer Lambda projects into OpenSearch. NOTE: the already-created live
# table currently has streams OFF — applying this config (after import) turns
# them on. See terraform/README.md.

resource "aws_dynamodb_table" "reports" {
  name         = var.dynamodb_table_name
  billing_mode = "PAY_PER_REQUEST"

  hash_key  = "pk"
  range_key = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  # Change-data-capture feed for the OpenSearch read model.
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  # Auto-expire the per-day upload rate-limit counters (pk=RATELIMIT). The "ttl"
  # attribute carries a Unix-epoch expiry written by lib/store.ts. Correctness of
  # the cap does not depend on TTL (each day has its own date-keyed sk) — this
  # just garbage-collects stale counter items.
  ttl {
    attribute_name = "ttl"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = var.enable_point_in_time_recovery
  }

  tags = {
    Name = var.dynamodb_table_name
  }
}
