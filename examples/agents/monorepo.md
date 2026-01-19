# Monorepo

## Overview

This is a monorepo containing multiple services and shared packages.

## Structure

```
.
├── apps/
│   ├── api/               # Backend API service
│   ├── web/               # Frontend web app
│   └── worker/            # Background worker
├── packages/
│   ├── shared/            # Shared utilities
│   └── config/            # Shared configuration
├── infra/
│   ├── terraform/         # Infrastructure as code
│   └── k8s/               # Kubernetes manifests
├── scripts/               # Build and deploy scripts
└── turbo.json            # Turborepo config
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| api | 3000 | REST API backend |
| web | 8080 | React frontend |
| worker | - | Async job processor |

## Commands

- `pnpm install` - Install all dependencies
- `pnpm build` - Build all packages
- `pnpm dev` - Start development servers
- `pnpm test` - Run all tests

## Infrastructure

- Terraform in `infra/terraform/`
- Kubernetes manifests in `infra/k8s/`
- CI/CD via GitHub Actions

## Conventions

- Use conventional commits
- PRs require at least one approval
- All services must have health endpoints
- Shared code goes in `packages/`
