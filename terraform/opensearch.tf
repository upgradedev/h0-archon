# OpenSearch — the CQRS read model (search + analytics).
#
# Single t3.small.search data node, public endpoint (no VPC), 10 GiB gp3, fully
# encrypted (at-rest + node-to-node), HTTPS-only with TLS 1.2. This matches the
# live `archon-search` domain captured via `aws opensearch describe-domain`.
#
# The domain access policy is built from var.region/var.account_id/name rather
# than from the domain's own ARN, on purpose: referencing
# aws_opensearch_domain.archon_search.arn inside its own access_policies would
# create a Terraform dependency cycle.

data "aws_iam_policy_document" "opensearch_access" {
  statement {
    sid    = "AllowAccountRootFullAccess"
    effect = "Allow"

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${var.account_id}:root"]
    }

    actions   = ["es:*"]
    resources = ["arn:aws:es:${var.region}:${var.account_id}:domain/${var.opensearch_domain_name}/*"]
  }
}

resource "aws_opensearch_domain" "archon_search" {
  domain_name    = var.opensearch_domain_name
  engine_version = var.opensearch_engine_version

  cluster_config {
    instance_type            = var.opensearch_instance_type
    instance_count           = var.opensearch_instance_count
    dedicated_master_enabled = false
    zone_awareness_enabled   = false
  }

  ebs_options {
    ebs_enabled = true
    volume_type = var.opensearch_volume_type
    volume_size = var.opensearch_volume_size
    # Pinned to the live values so plan does not drift post-import.
    iops       = var.opensearch_volume_iops
    throughput = var.opensearch_volume_throughput
  }

  # At-rest encryption uses the AWS-managed `aws/es` key by default (kms_key_id
  # omitted), which matches the live domain. If a future plan shows kms_key_id
  # drift, pin it to the captured key ARN.
  encrypt_at_rest {
    enabled = true
  }

  node_to_node_encryption {
    enabled = true
  }

  domain_endpoint_options {
    enforce_https       = true
    tls_security_policy = "Policy-Min-TLS-1-2-2019-07"
  }

  # Live domain has these set; declaring them avoids post-import drift.
  advanced_options = {
    "rest.action.multi.allow_explicit_index" = "true"
    "override_main_response_version"         = "false"
  }

  access_policies = data.aws_iam_policy_document.opensearch_access.json

  tags = {
    Name = var.opensearch_domain_name
  }
}
