# Kubernetes Application

## Overview

This is a containerized application deployed to Kubernetes.

## Structure

```
.
├── src/                    # Application source code
├── manifests/
│   ├── base/              # Base Kustomize manifests
│   └── overlays/
│       ├── dev/
│       ├── staging/
│       └── prod/
├── charts/                 # Helm charts (if using Helm)
├── Dockerfile
└── skaffold.yaml
```

## Namespaces

- `app-dev` - Development environment
- `app-staging` - Staging environment
- `app-prod` - Production environment

## Deployment

Using Kustomize:
```
kubectl apply -k manifests/overlays/<env>
```

Using Helm:
```
helm upgrade --install app ./charts/app -n <namespace> -f values-<env>.yaml
```

## Conventions

- All deployments must have resource limits
- Use `RollingUpdate` strategy for deployments
- Readiness and liveness probes are required
- Secrets are managed via External Secrets Operator

## Debugging

- Check pod logs: `kubectl logs -f <pod> -n <namespace>`
- Exec into pod: `kubectl exec -it <pod> -n <namespace> -- /bin/sh`
- Port forward: `kubectl port-forward svc/<service> 8080:80 -n <namespace>`
