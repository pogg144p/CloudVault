output = {
  vpc_id = {
    description = "ID of the CloudVault Virtual Private Cloud"
    value       = aws_vpc.main.id
  }
  s3_bucket_name = {
    description = "Name of the provisioned secure S3 storage bucket"
    value       = aws_s3_bucket.vault.id
  }
  rds_endpoint = {
    description = "Database connection endpoint for PostgreSQL"
    value       = aws_db_instance.postgres.endpoint
  }
  rds_database_name = {
    description = "Target database name"
    value       = aws_db_instance.postgres.db_name
  }
  eks_cluster_name = {
    description = "Name of the provisioned Amazon EKS cluster"
    value       = aws_eks_cluster.main.name
  }
  eks_cluster_endpoint = {
    description = "Kubernetes control plane API server endpoint"
    value       = aws_eks_cluster.main.endpoint
  }
  kubeconfig_command = {
    description = "Run this command to configure kubectl credentials"
    value       = "aws eks --region ${var.aws_region} update-kubeconfig --name ${aws_eks_cluster.main.name}"
  }
}
