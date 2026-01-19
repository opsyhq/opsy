# Helm Skills

When working with Helm, follow these guidelines:

## Safety Rules

1. **Always confirm the cluster context** before operations:
   ```bash
   kubectl config current-context
   ```

2. **Use `--dry-run` to preview changes** before install/upgrade

3. **Check existing releases** before installing:
   ```bash
   helm list -n <namespace>
   ```

4. **Never uninstall releases without explicit confirmation** - This deletes all managed resources

## Command Classification

### Safe Operations (read-only)
- `helm list` - List releases
- `helm status` - Show release status
- `helm history` - Show release history
- `helm get` - Get release details (values, manifest, notes)
- `helm show` - Show chart info
- `helm search` - Search for charts
- `helm repo list` - List repos
- `helm template` - Render templates locally

### Caution Operations (modify)
- `helm install` - Install a release
- `helm upgrade` - Upgrade a release
- `helm rollback` - Rollback to previous release
- `helm repo add` / `helm repo update` - Manage repos

### Dangerous Operations (destructive)
- `helm uninstall` - Delete release and resources
- `helm repo remove` - Remove repository

## Best Practices

1. **Always use namespaces**:
   ```bash
   helm install myrelease chart -n my-namespace --create-namespace
   ```

2. **Preview before install/upgrade**:
   ```bash
   helm install myrelease chart --dry-run --debug
   helm template myrelease chart  # Local render only
   ```

3. **Use values files** for configuration:
   ```bash
   helm install myrelease chart -f values.yaml -f values-prod.yaml
   ```

4. **Check diff before upgrade** (requires helm-diff plugin):
   ```bash
   helm diff upgrade myrelease chart -f values.yaml
   ```

## Common Workflows

### Add and Update Repos
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
```

### Search for Charts
```bash
helm search repo nginx
helm search hub nginx  # Search Artifact Hub
```

### Install with Custom Values
```bash
helm install myapp bitnami/nginx \
  -n my-namespace \
  --create-namespace \
  -f values.yaml \
  --set replicaCount=3
```

### Upgrade Release
```bash
helm upgrade myapp bitnami/nginx \
  -n my-namespace \
  -f values.yaml \
  --set replicaCount=5
```

### Check Release Status
```bash
helm list -n my-namespace
helm status myapp -n my-namespace
helm history myapp -n my-namespace
```

### Rollback
```bash
helm rollback myapp 1 -n my-namespace  # Rollback to revision 1
```

### Get Release Info
```bash
helm get values myapp -n my-namespace
helm get manifest myapp -n my-namespace
helm get notes myapp -n my-namespace
```

### Uninstall (Careful!)
```bash
helm uninstall myapp -n my-namespace
```
