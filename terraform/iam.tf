# IAM — least-privilege policies for the two runtime principals.
#
#   (a) The app (Vercel Functions): read/write the table, invoke Bedrock for
#       extraction, and run search queries against OpenSearch.
#   (b) The indexer Lambda: consume the DynamoDB stream and index into
#       OpenSearch, plus basic CloudWatch Logs.

# ---------------------------------------------------------------------------
# (a) Application principal (Vercel)
# ---------------------------------------------------------------------------
# Attach `aws_iam_policy.app` to the IAM user whose access keys the Vercel
# deployment uses (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY). It is intentionally
# scoped to the single table, the EU Claude inference profile, and the one domain.

data "aws_iam_policy_document" "app" {
  # Key-based read/write on the single CQRS table (matches lib/store.ts: Put + Query).
  statement {
    sid    = "DynamoReportsReadWrite"
    effect = "Allow"
    actions = [
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:Query",
    ]
    resources = [aws_dynamodb_table.reports.arn]
  }

  # Bedrock extraction. Invoking a cross-region inference profile requires BOTH
  # the inference-profile ARN AND the underlying foundation-model ARNs in the
  # regions the profile routes to (here: the EU regions).
  statement {
    sid    = "BedrockInvokeClaudeSonnet"
    effect = "Allow"
    actions = [
      "bedrock:InvokeModel",
      "bedrock:InvokeModelWithResponseStream",
    ]
    resources = [
      "arn:aws:bedrock:${var.region}:${var.account_id}:inference-profile/${var.bedrock_inference_profile_id}",
      "arn:aws:bedrock:*::foundation-model/anthropic.claude-sonnet-4-6*",
    ]
  }

  # Read-only search/analytics against the OpenSearch read model.
  statement {
    sid    = "OpenSearchQuery"
    effect = "Allow"
    actions = [
      "es:ESHttpGet",
      "es:ESHttpPost",
    ]
    resources = ["${aws_opensearch_domain.archon_search.arn}/*"]
  }
}

resource "aws_iam_policy" "app" {
  name        = "${var.project}-app"
  description = "App (Vercel) access: DynamoDB reports, Bedrock extraction, OpenSearch query."
  policy      = data.aws_iam_policy_document.app.json
}

# ---------------------------------------------------------------------------
# (b) Indexer Lambda execution role
# ---------------------------------------------------------------------------
data "aws_iam_policy_document" "indexer_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "indexer" {
  name               = "${var.project}-indexer"
  assume_role_policy = data.aws_iam_policy_document.indexer_assume.json

  tags = {
    Name = "${var.project}-indexer"
  }
}

data "aws_iam_policy_document" "indexer" {
  # Consume the DynamoDB stream (CDC source).
  statement {
    sid    = "ReadDynamoStream"
    effect = "Allow"
    actions = [
      "dynamodb:GetRecords",
      "dynamodb:GetShardIterator",
      "dynamodb:DescribeStream",
      "dynamodb:ListStreams",
    ]
    resources = [
      aws_dynamodb_table.reports.stream_arn,
      "${aws_dynamodb_table.reports.stream_arn}/*",
    ]
  }

  # Index projected documents into the OpenSearch read model.
  statement {
    sid    = "WriteOpenSearch"
    effect = "Allow"
    actions = [
      "es:ESHttpPost",
      "es:ESHttpPut",
    ]
    resources = ["${aws_opensearch_domain.archon_search.arn}/*"]
  }

  # Basic Lambda logging.
  statement {
    sid    = "Logs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = ["arn:aws:logs:${var.region}:${var.account_id}:*"]
  }
}

resource "aws_iam_role_policy" "indexer" {
  name   = "${var.project}-indexer"
  role   = aws_iam_role.indexer.id
  policy = data.aws_iam_policy_document.indexer.json
}
