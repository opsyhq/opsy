# Examples

Example configurations, runbooks, and AGENTS.md files for opsy.

## Configs

Example opsy configuration files. Copy to `~/.opsy/opsy.jsonc` or `.opsy/opsy.jsonc`.

| Config | Description |
|--------|-------------|
| [eks-ops.jsonc](./configs/eks-ops.jsonc) | EKS cluster operations (AWS, kubectl, Helm) |
| [terraform-ops.jsonc](./configs/terraform-ops.jsonc) | Terraform infrastructure management |
| [full-devops.jsonc](./configs/full-devops.jsonc) | Full DevOps setup with all tools |

## Runbooks

Markdown runbooks that opsy can follow for common tasks. Reference them by attaching with `@`:

```
> @runbooks/eks-upgrade.md upgrade my dev cluster to 1.29
```

| Runbook | Description |
|---------|-------------|
| [eks-upgrade.md](./runbooks/eks-upgrade.md) | EKS cluster upgrade procedure |
| [terraform-state-recovery.md](./runbooks/terraform-state-recovery.md) | Terraform state recovery |
| [k8s-pod-debugging.md](./runbooks/k8s-pod-debugging.md) | Kubernetes pod debugging |

## AGENTS.md

Example AGENTS.md files for different project types. Copy to your project root.

| Template | Description |
|----------|-------------|
| [terraform-project.md](./agents/terraform-project.md) | Terraform infrastructure project |
| [kubernetes-app.md](./agents/kubernetes-app.md) | Kubernetes application |
| [monorepo.md](./agents/monorepo.md) | Monorepo with multiple services |

Or run `/init` in opsy to auto-generate one for your project.
