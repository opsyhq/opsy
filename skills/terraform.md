# Terraform Skills

When working with Terraform, follow these guidelines:

## Safety Rules

1. **Always run `terraform plan` before `terraform apply`** - Show the user what will change
2. **Never run `terraform destroy` without explicit confirmation** - This is a destructive operation
3. **Detect workspace/environment automatically** - Check `terraform workspace show` before operations
4. **Warn about state-modifying operations** - `terraform state rm`, `terraform import`, `terraform taint`

## Command Patterns

### Safe Operations (read-only)
- `terraform plan` - Preview changes
- `terraform show` - Show current state
- `terraform state list` - List resources in state
- `terraform output` - Show outputs
- `terraform workspace list` - List workspaces
- `terraform providers` - Show providers
- `terraform validate` - Validate configuration

### Caution Operations (modify state)
- `terraform apply` - Apply changes (requires plan first)
- `terraform import` - Import existing resources
- `terraform state mv` - Move resources in state
- `terraform refresh` - Refresh state

### Dangerous Operations (destructive)
- `terraform destroy` - Destroy all resources
- `terraform state rm` - Remove from state (resource still exists)
- `terraform taint` - Mark resource for recreation

## Best Practices

1. **Check the workspace** before any operation:
   ```bash
   terraform workspace show
   ```

2. **Use `-target` sparingly** - It can lead to state drift

3. **Review plan output carefully** - Look for:
   - Resources being destroyed (`-`)
   - Resources being recreated (`-/+`)
   - Unexpected changes

4. **Lock state** when working in teams - Use remote backend with locking

5. **Never commit `.tfvars` with secrets** - Use environment variables or secret managers

## Common Workflows

### Initialize and Plan
```bash
terraform init
terraform plan -out=tfplan
```

### Apply with Plan File
```bash
terraform apply tfplan
```

### Import Existing Resource
```bash
terraform import aws_instance.example i-1234567890abcdef0
```

### Move Resource in State
```bash
terraform state mv aws_instance.old aws_instance.new
```
