# Terraform State Recovery Runbook

This runbook guides opsy through recovering Terraform state issues.

## Symptoms

- State file is corrupted or missing
- State is out of sync with actual infrastructure
- Need to import existing resources

## Recovery Procedures

### 1. State Backup Check

First, check if opsy has automatic backups:

```
ls ~/.local/share/opsy/terraform/<project>/backups/
```

### 2. Restore from Backup

If backup exists:

```
terraform state push <backup-file>
```

### 3. Import Missing Resources

For resources that exist but are not in state:

```
terraform import <resource_type>.<name> <resource_id>
```

Example:
```
terraform import aws_instance.web i-1234567890abcdef0
```

### 4. Refresh State

After imports, refresh to sync state with reality:

```
terraform refresh
```

### 5. Verify State

Run plan to verify state matches infrastructure:

```
terraform plan
```

Should show no changes if state is correct.

## Prevention

- Always use remote backend with locking
- Enable versioning on S3 state bucket
- Use opsy's automatic state backups
