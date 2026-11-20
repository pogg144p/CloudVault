variable "aws_region" {
  description = "AWS region for all CloudVault cloud resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Target deployment environment (dev, staging, prod)"
  type        = string
  default     = "prod"
}

variable "vpc_cidr" {
  description = "CIDR block for the CloudVault Virtual Private Cloud"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_instance_class" {
  description = "RDS PostgreSQL compute instance tier"
  type        = string
  default     = "db.t4g.micro"
}

variable "db_name" {
  description = "PostgreSQL default database name"
  type        = string
  default     = "cloudvault_db"
}

variable "db_username" {
  description = "PostgreSQL administrator username"
  type        = string
  default     = "cloudvault_admin"
}

variable "eks_cluster_version" {
  description = "Kubernetes control plane version for Amazon EKS"
  type        = string
  default     = "1.29"
}

variable "eks_node_instance_types" {
  description = "EC2 instance types for EKS worker nodes"
  type        = list(string)
  default     = ["t3.medium"]
}
