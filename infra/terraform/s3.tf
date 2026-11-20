# ─── S3 Object Storage with Lifecycle & Encryption ───

resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}

resource "aws_s3_bucket" "vault" {
  bucket        = "cloudvault-${var.environment}-${random_string.bucket_suffix.result}"
  force_destroy = var.environment == "dev" ? true : false

  tags = {
    Name = "cloudvault-storage-${var.environment}"
  }
}

# Enforce Bucket Versioning
resource "aws_s3_bucket_versioning" "vault_versioning" {
  bucket = aws_s3_bucket.vault.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Server-Side Encryption (AES256)
resource "aws_s3_bucket_server_side_encryption_configuration" "vault_encryption" {
  bucket = aws_s3_bucket.vault.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block all Public Access (access is only via Pre-Signed URLs and IAM)
resource "aws_s3_bucket_public_access_block" "vault_block_public" {
  bucket = aws_s3_bucket.vault.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# CORS policy for direct frontend uploads
resource "aws_s3_bucket_cors_configuration" "vault_cors" {
  bucket = aws_s3_bucket.vault.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "HEAD"]
    allowed_origins = ["https://*", "http://localhost:*"]
    expose_headers  = ["ETag", "x-amz-request-id"]
    max_age_seconds = 3600
  }
}

# FinOps Automated Storage Lifecycle Tiering (Standard -> IA -> Glacier)
resource "aws_s3_bucket_lifecycle_configuration" "vault_lifecycle" {
  bucket = aws_s3_bucket.vault.id

  rule {
    id     = "archive-cold-files"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 60
    }
  }
}
