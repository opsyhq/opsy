# Opsy monorepo — provider development targets
# Mirrors conventions from terraform-provider-* and pulumi-provider-* repos.
#
# Quick start:
#   make build          # compile the Go bridge binary
#   make setup          # download TF provider binaries
#   make test           # unit tests (no network, no creds)
#   make testacc        # live e2e tests (requires creds — see .env.test.example)

# ── Config ──────────────────────────────────────────────────────────────────
BRIDGE_BIN            := $(CURDIR)/bin/opsy-bridge
TF_PROVIDER_DIR       := $(CURDIR)/tf-providers
NULL_PROVIDER_DIR     := $(CURDIR)/bridge/integration/testdata/providers
# Comma-separated name=source@version catalog. Use | for multiple versions.
OPSY_TERRAFORM_PROVIDERS ?= aws=hashicorp/aws@6.44.0

export TF_PROVIDER_DIR
export OPSY_TERRAFORM_PROVIDERS

.PHONY: build setup test testacc smoke clean gen-wire help

# ── Codegen ──────────────────────────────────────────────────────────────────

## gen-wire: Generate packages/bridge-client/src/wire.generated.ts from Go structs
gen-wire:
	./scripts/gen-wire.sh

# ── Build ────────────────────────────────────────────────────────────────────

## build: Compile the Go bridge binary → bin/opsy-bridge
build: $(BRIDGE_BIN)

$(BRIDGE_BIN):
	@mkdir -p bin
	cd bridge && go build -o $(BRIDGE_BIN) .
	@echo "Built: $(BRIDGE_BIN)"

# ── Provider setup ───────────────────────────────────────────────────────────

## setup: Download TF provider binaries (idempotent, verifies SHA256)
setup:
	./scripts/setup-providers.sh

# ── Tests ────────────────────────────────────────────────────────────────────

## test: Unit tests — no network, no credentials required
## Runs each package's own `bun test` so per-package tsconfig path
## aliases resolve (root `bun test` would not). Mirrors `make typecheck`.
test:
	bun run test

## testacc: Live acceptance tests against real AWS (mirrors `make testacc` from TF provider repos)
## Requires: build + setup, plus AWS creds in env or .env.test
## Usage:  source .env.test && make testacc
##    or:  AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... make testacc
testacc: $(BRIDGE_BIN)
	OPSY_LIVE=1 \
	OPSY_BRIDGE_BIN=$(BRIDGE_BIN) \
	OPSY_PROVIDER_DIR=$(TF_PROVIDER_DIR) \
	bun test apps/api/src --env-file apps/api/.env.test --timeout 600000

## smoke: Bridge smoke test using the bundled null provider (no creds needed)
smoke: $(BRIDGE_BIN)
	OPSY_BRIDGE_BIN=$(BRIDGE_BIN) \
	OPSY_PROVIDER_DIR=$(NULL_PROVIDER_DIR) \
	bun run packages/bridge-client/test/smoke.ts

# ── Typecheck ────────────────────────────────────────────────────────────────

## typecheck: TypeScript typecheck across all packages
typecheck:
	bun run --filter '*' typecheck

# ── Clean ────────────────────────────────────────────────────────────────────

## clean: Remove compiled binary and downloaded provider binaries
clean:
	rm -rf bin/ tf-providers/

# ── Help ─────────────────────────────────────────────────────────────────────

## help: List available targets
help:
	@grep -E '^## ' Makefile | sed 's/## /  /'
