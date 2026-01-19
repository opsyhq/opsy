# Helm Tool

Opsy has a dedicated Helm tool that shares Kubernetes context for chart operations.

## Setup

1. Install [Helm](https://helm.sh/docs/intro/install/)
2. Configure Kubernetes contexts (Helm uses the same context)

## Select Context

In opsy, type `/kubernetes` (or `/k8s`) to select your Kubernetes context. Opsy will auto-inject `--kube-context` for all Helm commands.

## Usage

Run `opsy` to start interactive mode, then ask:

```
> list helm releases in production namespace
> show values for the nginx release
> upgrade the api release with new values
> rollback the web release to previous version
```

## Auto-Approval

Read-only commands are auto-approved:
- `list`, `ls`, `status`, `show`, `get`
- `history`, `search`
- `template`, `lint`, `verify`
- `env`, `version`
- `dependency list`

Modifying commands require approval:
- `install`, `upgrade`, `rollback`
- `uninstall`, `delete`
- `repo add`, `repo remove`

## Configuration

```jsonc
{
  "permission": {
    "helm": {
      "*": "ask",
      "helm list*": "allow",
      "helm status*": "allow",
      "helm get*": "allow"
    }
  }
}
```

## Common Workflows

```
> install nginx ingress controller in the ingress-nginx namespace
> upgrade the api release, set replicas to 5
> rollback the web release to revision 3
```
