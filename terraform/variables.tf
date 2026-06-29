# Input variables.
#
# Defaults reflect the live H0 deployment (account 308857099262 / eu-west-1) so a
# bare `terraform plan` reproduces the existing resources. Override per workspace
# as needed.

variable "region" {
  description = "AWS region for all resources."
  type        = string
  default     = "eu-west-1"
}

variable "account_id" {
  description = "AWS account ID (used to build self-referential ARNs without provider cycles)."
  type        = string
  default     = "308857099262"
}

variable "project" {
  description = "Project slug used as a resource name prefix and in tags."
  type        = string
  default     = "archon-h0"
}

# --- DynamoDB --------------------------------------------------------------

variable "dynamodb_table_name" {
  description = "Name of the single-table CQRS write-side store."
  type        = string
  default     = "h0-archon-reports"
}

variable "enable_point_in_time_recovery" {
  description = "Enable DynamoDB point-in-time recovery (PITR). Off by default to match the lean demo footprint; turn on for production."
  type        = bool
  default     = false
}

# --- OpenSearch ------------------------------------------------------------

variable "opensearch_domain_name" {
  description = "Name of the OpenSearch read-model domain."
  type        = string
  default     = "archon-search"
}

variable "opensearch_engine_version" {
  description = "OpenSearch engine version."
  type        = string
  default     = "OpenSearch_2.11"
}

variable "opensearch_instance_type" {
  description = "OpenSearch data node instance type."
  type        = string
  default     = "t3.small.search"
}

variable "opensearch_instance_count" {
  description = "Number of OpenSearch data nodes."
  type        = number
  default     = 1
}

variable "opensearch_volume_size" {
  description = "EBS volume size per node, in GiB."
  type        = number
  default     = 10
}

variable "opensearch_volume_type" {
  description = "EBS volume type for OpenSearch data nodes."
  type        = string
  default     = "gp3"
}

variable "opensearch_volume_iops" {
  description = "Provisioned IOPS for the gp3 volume (live default is 3000)."
  type        = number
  default     = 3000
}

variable "opensearch_volume_throughput" {
  description = "Throughput (MiB/s) for the gp3 volume (live default is 125)."
  type        = number
  default     = 125
}

variable "opensearch_index" {
  description = "OpenSearch index the indexer Lambda writes projected documents into."
  type        = string
  default     = "archon-reports"
}

# --- Bedrock ---------------------------------------------------------------

variable "bedrock_inference_profile_id" {
  description = "Bedrock cross-region inference profile id the app invokes for extraction (EU Claude Sonnet 4.6)."
  type        = string
  default     = "eu.anthropic.claude-sonnet-4-6"
}
