# AWS provider configuration.
#
# Region is variable-driven (defaults to eu-west-1, where the live H0 resources
# already exist). `default_tags` stamps every taggable resource with the project
# and ManagedBy markers so we never repeat tags per-resource.

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "archon-h0"
      ManagedBy = "terraform"
    }
  }
}
