# ─── Managed Amazon RDS PostgreSQL Database ───

resource "random_password" "db_password" {
  length  = 24
  special = false
}

resource "aws_db_subnet_group" "rds" {
  name        = "cloudvault-${var.environment}-db-subnet-group"
  subnet_ids  = aws_subnet.database[*].id
  description = "Isolated subnets for CloudVault RDS instances"

  tags = {
    Name = "cloudvault-${var.environment}-db-subnets"
  }
}

resource "aws_security_group" "rds" {
  name        = "cloudvault-${var.environment}-rds-sg"
  description = "Allow inbound PostgreSQL traffic from EKS worker nodes only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "PostgreSQL port from private subnets"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = aws_subnet.private[*].cidr_block
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "cloudvault-rds-sg"
  }
}

resource "aws_db_instance" "postgres" {
  identifier        = "cloudvault-${var.environment}-postgres"
  engine            = "postgres"
  engine_version    = "16.1"
  instance_class    = var.db_instance_class
  allocated_storage = 20
  max_allocated_storage = 100
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db_password.result

  db_subnet_group_name   = aws_db_subnet_group.rds.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 7
  backup_window           = "03:00-04:00"
  maintenance_window      = "Sun:04:30-Sun:05:30"
  deletion_protection     = var.environment == "prod" ? true : false
  skip_final_snapshot     = var.environment == "dev" ? true : false

  tags = {
    Name = "cloudvault-${var.environment}-db"
  }
}
