# Terraform + provider version constraints.
#
# Pinned conservatively: the AWS provider 5.x line is required for the
# `aws_opensearch_domain` resource and modern `aws_dynamodb_table` stream
# arguments used here. The `archive` provider zips the indexer Lambda source
# in-tree (no external build step).

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }
}
