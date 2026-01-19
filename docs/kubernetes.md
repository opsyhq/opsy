# Kubernetes Tool

Opsy has a dedicated kubectl tool with context awareness and automatic context injection.

## Setup

1. Install [kubectl](https://kubernetes.io/docs/tasks/tools/)
2. Configure contexts in `~/.kube/config`

## Select Context

In opsy, type `/kubernetes` (or `/k8s`) to select your Kubernetes context. Opsy will auto-inject `--context` for all commands.

## Usage

Run `opsy` to start interactive mode, then ask:

```
> list pods in the default namespace
> describe the nginx deployment
> show logs for the api pod
> scale the web deployment to 3 replicas
```

## Auto-Approval

Read-only commands are auto-approved:
- `get`, `describe`, `logs`, `top`
- `explain`, `api-resources`, `api-versions`
- `cluster-info`, `config`, `version`
- `auth`, `diff`

Modifying commands require approval:
- `apply`, `create`, `delete`
- `scale`, `rollout`, `patch`
- `exec`, `port-forward`

## Configuration

```jsonc
{
  "permission": {
    "kubernetes": {
      "*": "ask",
      "kubectl get*": "allow",
      "kubectl describe*": "allow",
      "kubectl logs*": "allow"
    }
  }
}
```

## Namespace

Specify namespace in your commands or opsy will use the default from your kubeconfig:

```
opsy "get pods in kube-system namespace"
opsy "describe svc nginx -n production"
```
