#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cd bridge && go run ./cmd/gen-wire > ../packages/bridge-client/src/wire.generated.ts
cd ..
bunx biome format --write packages/bridge-client/src/wire.generated.ts
