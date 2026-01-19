# Kubernetes Pod Debugging Runbook

This runbook guides opsy through debugging pod issues.

## Common Issues

### Pod Not Starting

1. Check pod status and events:
```
kubectl describe pod <pod-name> -n <namespace>
```

2. Check for image pull errors:
```
kubectl get events -n <namespace> --field-selector reason=Failed
```

3. Check resource constraints:
```
kubectl describe node <node-name> | grep -A 5 "Allocated resources"
```

### Pod CrashLooping

1. Check logs from current container:
```
kubectl logs <pod-name> -n <namespace>
```

2. Check logs from previous crashed container:
```
kubectl logs <pod-name> -n <namespace> --previous
```

3. Check liveness/readiness probe configuration:
```
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A 10 "livenessProbe"
```

### Pod Stuck in Pending

1. Check events for scheduling issues:
```
kubectl describe pod <pod-name> -n <namespace> | grep -A 10 Events
```

2. Check node resources:
```
kubectl top nodes
```

3. Check for node selectors or affinity rules:
```
kubectl get pod <pod-name> -n <namespace> -o yaml | grep -A 5 "nodeSelector"
```

## Quick Diagnostics

Run these to get quick overview:

```
kubectl get pods -n <namespace> -o wide
kubectl top pods -n <namespace>
kubectl get events -n <namespace> --sort-by='.lastTimestamp'
```
