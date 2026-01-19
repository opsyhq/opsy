# AWS CLI Skills

When working with AWS CLI, follow these guidelines:

## Safety Rules

1. **Always confirm the AWS profile/account** before operations:
   ```bash
   aws sts get-caller-identity
   ```

2. **Never delete resources without explicit confirmation** - `delete`, `terminate`, `remove` commands

3. **Check region** - Operations are region-specific:
   ```bash
   aws configure get region
   ```

4. **Use `--dry-run` when available** - EC2 commands support this flag

## Command Classification

### Safe Operations (read-only)
- `aws * describe-*` - Describe resources
- `aws * list-*` - List resources
- `aws * get-*` - Get resource details
- `aws sts get-caller-identity` - Check identity
- `aws s3 ls` - List buckets/objects

### Caution Operations (modify)
- `aws * create-*` - Create resources (costs money)
- `aws * update-*` - Update resources
- `aws * modify-*` - Modify resources
- `aws * put-*` - Put/upload data
- `aws s3 cp` / `aws s3 sync` - Copy/sync files

### Dangerous Operations (destructive)
- `aws * delete-*` - Delete resources
- `aws * terminate-*` - Terminate instances
- `aws * remove-*` - Remove resources
- `aws s3 rm --recursive` - Delete all objects

## Best Practices

1. **Use named profiles** for different accounts:
   ```bash
   aws --profile production sts get-caller-identity
   ```

2. **Use `--output table`** for readable output:
   ```bash
   aws ec2 describe-instances --output table
   ```

3. **Filter with JMESPath** for specific data:
   ```bash
   aws ec2 describe-instances --query 'Reservations[].Instances[].InstanceId'
   ```

4. **Use tags** for resource identification:
   ```bash
   aws ec2 describe-instances --filters "Name=tag:Environment,Values=prod"
   ```

## Common Workflows

### Check Current Context
```bash
aws sts get-caller-identity
aws configure get region
```

### List EC2 Instances
```bash
aws ec2 describe-instances --query 'Reservations[].Instances[].[InstanceId,State.Name,Tags[?Key==`Name`].Value|[0]]' --output table
```

### Check EKS Clusters
```bash
aws eks list-clusters
aws eks describe-cluster --name <cluster-name>
```

### S3 Operations
```bash
aws s3 ls s3://bucket-name/
aws s3 cp file.txt s3://bucket-name/
aws s3 sync ./local-dir s3://bucket-name/prefix/
```
