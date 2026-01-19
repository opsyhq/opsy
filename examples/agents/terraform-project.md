# Terraform Infrastructure Project

## Overview

This is a Terraform project for managing AWS infrastructure.

## Structure

```
.
├── environments/
│   ├── dev/
│   ├── staging/
│   └── prod/
├── modules/
│   ├── vpc/
│   ├── eks/
│   └── rds/
├── main.tf
├── variables.tf
├── outputs.tf
└── terraform.tfvars
```

## Conventions

- Use workspaces for environment separation
- All resources must be tagged with `Environment` and `ManagedBy=terraform`
- Module versions should be pinned
- State is stored in S3 with DynamoDB locking

## Commands

- `terraform init` - Initialize working directory
- `terraform plan` - Preview changes
- `terraform apply` - Apply changes (requires plan file)

## Safety Rules

- Never run `terraform destroy` without explicit approval
- Always run `terraform plan` before `terraform apply`
- Check the workspace before any operation
- Review plan output for unexpected destroys
