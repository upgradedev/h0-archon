# Stack outputs — the values other layers (app env, ops, docs) consume.

output "dynamodb_table_name" {
  description = "Name of the CQRS write-side table."
  value       = aws_dynamodb_table.reports.name
}

output "dynamodb_table_arn" {
  description = "ARN of the CQRS write-side table."
  value       = aws_dynamodb_table.reports.arn
}

output "dynamodb_stream_arn" {
  description = "DynamoDB Streams ARN feeding the indexer Lambda."
  value       = aws_dynamodb_table.reports.stream_arn
}

output "opensearch_endpoint" {
  description = "HTTPS endpoint of the OpenSearch read-model domain."
  value       = aws_opensearch_domain.archon_search.endpoint
}

output "opensearch_arn" {
  description = "ARN of the OpenSearch read-model domain."
  value       = aws_opensearch_domain.archon_search.arn
}

output "indexer_lambda_name" {
  description = "Name of the stream-processor Lambda."
  value       = aws_lambda_function.indexer.function_name
}

output "indexer_role_arn" {
  description = "Execution role ARN for the indexer Lambda."
  value       = aws_iam_role.indexer.arn
}

output "app_policy_arn" {
  description = "ARN of the app (Vercel) IAM policy — attach to the deployment's IAM user."
  value       = aws_iam_policy.app.arn
}
