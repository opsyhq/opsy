# Kubectl Skills

When working with Kubernetes via kubectl, follow these guidelines:

## Safety Rules

1. **Always confirm the cluster context** before operations:
   ```bash
   kubectl config current-context
   kubectl cluster-info
   ```

2. **Check namespace** - Most commands are namespace-scoped:
   ```bash
   kubectl config view --minify --output 'jsonpath={..namespace}'
   ```

3. **Use `--dry-run=client` for write operations** to preview changes

4. **Never delete namespaces without explicit confirmation** - Deletes ALL resources in it

## Command Classification

### Safe Operations (read-only)
- `kubectl get` - List resources
- `kubectl describe` - Show resource details
- `kubectl logs` - View pod logs
- `kubectl top` - Resource usage
- `kubectl config view` - View config
- `kubectl cluster-info` - Cluster info
- `kubectl api-resources` - List API resources

### Caution Operations (modify)
- `kubectl apply` - Apply configuration
- `kubectl create` - Create resources
- `kubectl patch` - Patch resources
- `kubectl scale` - Scale deployments
- `kubectl rollout` - Manage rollouts
- `kubectl label` / `kubectl annotate` - Add metadata
- `kubectl exec` - Execute in container

### Dangerous Operations (destructive)
- `kubectl delete` - Delete resources
- `kubectl delete namespace` - Delete entire namespace
- `kubectl drain` - Drain node (evicts pods)
- `kubectl cordon` - Mark node unschedulable
- `kubectl replace --force` - Force replace (deletes first)

## Best Practices

1. **Always specify namespace explicitly**:
   ```bash
   kubectl get pods -n my-namespace
   ```

2. **Use labels for filtering**:
   ```bash
   kubectl get pods -l app=nginx
   ```

3. **Preview before apply**:
   ```bash
   kubectl apply -f manifest.yaml --dry-run=client
   kubectl diff -f manifest.yaml
   ```

4. **Use `kubectl explain`** for resource documentation:
   ```bash
   kubectl explain pod.spec.containers
   ```

## Common Workflows

### Check Cluster Context
```bash
kubectl config current-context
kubectl config get-contexts
```

### Debug Pod Issues
```bash
kubectl get pods -n <namespace>
kubectl describe pod <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace>
kubectl logs <pod-name> -n <namespace> --previous  # Previous container logs
```

### Scale Deployment
```bash
kubectl scale deployment <name> --replicas=3 -n <namespace>
```

### Rollout Management
```bash
kubectl rollout status deployment/<name> -n <namespace>
kubectl rollout history deployment/<name> -n <namespace>
kubectl rollout undo deployment/<name> -n <namespace>
```

### Port Forward
```bash
kubectl port-forward pod/<pod-name> 8080:80 -n <namespace>
kubectl port-forward svc/<service-name> 8080:80 -n <namespace>
```

### Execute in Container
```bash
kubectl exec -it <pod-name> -n <namespace> -- /bin/sh
```
