terraform {
  backend "s3" {
    bucket = "aaron-moore-terraform"
    key    = "theatre-db/terraform_state"
    region = "us-west-2"
  }
}
locals {
  project = "theatredb"
  region  = "us-west-2"
}
provider "aws" {
  version    = "~> 2.20"
  profile    = "default"
  region = "${local.region}"
}

# ==============
# AUTHENTICATION
# ==============
resource "aws_cognito_user_pool" "pool" {
  name = "${local.project}_pool"
  auto_verified_attributes = ["email"]
}
resource "aws_cognito_user_pool_client" "client" {
  name = "${local.project}_client"

  user_pool_id = "${aws_cognito_user_pool.pool.id}"
}
resource "aws_cognito_identity_pool" "pool" {
  identity_pool_name               = "theatredb_identity_pool"
  allow_unauthenticated_identities = false

  cognito_identity_providers {
    client_id               = "${aws_cognito_user_pool_client.client.id}"
    provider_name           = "${aws_cognito_user_pool.pool.endpoint}"
    server_side_token_check = false
  }
}
resource "aws_iam_role" "authenticated" {
  name = "${local.project}_cognito_authenticated"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "${aws_cognito_identity_pool.pool.id}"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "authenticated"
        }
      }
    }
  ]
}
EOF
}
resource "aws_iam_role_policy" "authenticated" {
  name = "${local.project}_authenticated_policy"
  role = "${aws_iam_role.authenticated.id}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "mobileanalytics:PutEvents",
        "cognito-sync:*",
        "cognito-identity:*"
      ],
      "Resource": [
        "*"
      ]
    }
  ]
}
EOF
}
resource "aws_cognito_identity_pool_roles_attachment" "main" {
  identity_pool_id = "${aws_cognito_identity_pool.pool.id}"
  roles = {
    "authenticated" = "${aws_iam_role.authenticated.arn}"
  }
  role_mapping {
    identity_provider         = "${aws_cognito_user_pool.pool.endpoint}:${aws_cognito_user_pool_client.client.id}"
    ambiguous_role_resolution = "AuthenticatedRole"
    type                      = "Token"
  }
}
resource "aws_iam_role" "admin_group_role" {
  name = "${local.project}-admin-group-role"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "",
      "Effect": "Allow",
      "Principal": {
        "Federated": "cognito-identity.amazonaws.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "cognito-identity.amazonaws.com:aud": "${aws_cognito_identity_pool.pool.id}"
        },
        "ForAnyValue:StringLike": {
          "cognito-identity.amazonaws.com:amr": "authenticated"
        }
      }
    }
  ]
}
EOF
}
resource "aws_iam_role_policy" "admin_group_policy" {
  name = "${local.project}_admin_group_policy"
  role = "${aws_iam_role.admin_group_role.id}"
  policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "mobileanalytics:PutEvents",
        "cognito-sync:*",
        "cognito-identity:*"
      ],
      "Resource": [
        "*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": "sqs:ListQueues",
      "Resource": "arn:aws:sqs:*"
    },
    {
      "Sid": "ListAndDescribe",
      "Effect": "Allow",
      "Action": [
        "dynamodb:List*",
        "dynamodb:DescribeReservedCapacity*",
        "dynamodb:DescribeLimits",
        "dynamodb:DescribeTimeToLive"
      ],
      "Resource": "*"
    },
    {
        "Sid": "SpecificTable",
        "Effect": "Allow",
        "Action": [
          "dynamodb:BatchGet*",
          "dynamodb:DescribeStream",
          "dynamodb:DescribeTable",
          "dynamodb:Get*",
          "dynamodb:Query",
          "dynamodb:Scan",
          "dynamodb:BatchWrite*",
          "dynamodb:CreateTable",
          "dynamodb:Delete*",
          "dynamodb:Update*",
          "dynamodb:PutItem"
        ],
        "Resource": "arn:aws:dynamodb:*:*:table/${local.project}.*"
    }
  ]
}
EOF
}
resource "aws_cognito_user_group" "admin" {
  name         = "admin-group"
  user_pool_id = "${aws_cognito_user_pool.pool.id}"
  precedence   = 0
  role_arn     = "${aws_iam_role.admin_group_role.arn}"
}

# ========
# DATABASE
# ========
resource "aws_dynamodb_table" "organizations" {
  name           = "${local.project}.organizations"
  billing_mode   = "PAY_PER_REQUEST"
  read_capacity  = 10
  write_capacity = 5
  hash_key       = "id"
  attribute {
    name = "id"
    type = "S"
  }
}

output "region" {
  value = "${local.region}"
}
output "user_pool_id" {
  value = "${aws_cognito_user_pool.pool.id}"
}
output "user_pool_client_id" {
  value = "${aws_cognito_user_pool_client.client.id}"
}
output "identity_pool_id" {
  value = "${aws_cognito_identity_pool.pool.id}"
}
