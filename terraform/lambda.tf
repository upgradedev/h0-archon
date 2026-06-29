# Lambda — the CQRS stream processor (DynamoDB Streams -> OpenSearch).
#
# `archive_file` zips terraform/lambda/ in-tree (no external build step). The zip
# intentionally contains ONLY index.mjs + package.json: every dependency the
# handler imports (@aws-sdk/*, @aws-crypto/sha256-js) is provided by the
# nodejs20.x managed runtime, so there is no node_modules to vendor. See README.

data "archive_file" "indexer" {
  type        = "zip"
  source_dir  = "${path.module}/lambda"
  output_path = "${path.module}/build/archon-indexer.zip"
}

resource "aws_lambda_function" "indexer" {
  function_name = "archon-indexer"
  role          = aws_iam_role.indexer.arn

  runtime = "nodejs20.x"
  handler = "index.handler"

  filename         = data.archive_file.indexer.output_path
  source_code_hash = data.archive_file.indexer.output_base64sha256

  timeout     = 30
  memory_size = 256

  environment {
    variables = {
      OPENSEARCH_ENDPOINT = aws_opensearch_domain.archon_search.endpoint
      OPENSEARCH_INDEX    = var.opensearch_index
    }
  }

  tags = {
    Name = "archon-indexer"
  }
}

# Wire the table's stream to the Lambda. LATEST = process new changes only; small
# batches keep per-record indexing simple and latency low.
resource "aws_lambda_event_source_mapping" "indexer" {
  event_source_arn  = aws_dynamodb_table.reports.stream_arn
  function_name     = aws_lambda_function.indexer.arn
  starting_position = "LATEST"
  batch_size        = 10

  # Don't block the shard forever on a poison record.
  maximum_retry_attempts = 3
  bisect_batch_on_function_error = true
}
