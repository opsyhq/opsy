# syntax=docker/dockerfile:1.7
# Build context: repo root.  Invoked as: docker build -f apps/api/Dockerfile .
# Target platform: linux/arm64 (Fargate Graviton).

# ── Stage 1: build the Go bridge ─────────────────────────────────────────────
FROM --platform=$BUILDPLATFORM golang:1.26-alpine AS bridge-builder
WORKDIR /src
RUN apk add --no-cache git ca-certificates
COPY bridge/go.mod bridge/go.sum ./bridge/
RUN cd bridge && go mod download
COPY bridge ./bridge
ARG TARGETOS=linux
ARG TARGETARCH=arm64
RUN cd bridge && CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -trimpath -ldflags='-s -w' -o /out/opsy-bridge .

# ── Stage 2: build the Nitro API server with bun ─────────────────────────────
FROM oven/bun:1.3.11 AS api-builder
WORKDIR /repo
ENV NODE_ENV=production
COPY package.json bun.lock tsconfig.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/landing/package.json ./apps/landing/
COPY apps/thinking-block-ui/package.json ./apps/thinking-block-ui/
COPY apps/web/package.json ./apps/web/
COPY packages ./packages
COPY patches ./patches
RUN bun install --frozen-lockfile
COPY apps/api ./apps/api
RUN bun run --cwd apps/api build
RUN set -eux; \
    mkdir -p apps/api/.output/server/node_modules; \
    undici_pkg="$(find node_modules/.bun -path '*/node_modules/undici/package.json' -print -quit)"; \
    test -n "$undici_pkg"; \
    cp -R "$(dirname "$undici_pkg")" apps/api/.output/server/node_modules/undici

# ── Stage 3: download configured Terraform provider plugins ──────────────────
FROM alpine:3.20 AS provider-cache
ARG OPSY_TERRAFORM_PROVIDERS=aws=hashicorp/aws@6.44.0
ARG TARGETARCH=arm64
RUN apk add --no-cache curl unzip
RUN set -eux; \
    mkdir -p /tmp/dl /out; \
    echo "$OPSY_TERRAFORM_PROVIDERS" | tr ',' '\n' | while read -r entry; do \
      entry="$(echo "$entry" | xargs)"; \
      [ -n "$entry" ] || continue; \
      ref="${entry#*=}"; \
      source="${ref%@*}"; \
      version_list="${ref##*@}"; \
      name="${source##*/}"; \
      if [ -z "$source" ] || [ "$source" = "$ref" ] || [ -z "$version_list" ]; then \
        echo "invalid OPSY_TERRAFORM_PROVIDERS entry: $entry" >&2; \
        exit 1; \
      fi; \
      echo "$version_list" | tr '|' '\n' | while read -r version; do \
        version="$(echo "$version" | xargs)"; \
        if [ -z "$version" ]; then \
          echo "invalid OPSY_TERRAFORM_PROVIDERS entry: $entry" >&2; \
          exit 1; \
        fi; \
        base="https://releases.hashicorp.com/terraform-provider-${name}/${version}"; \
        zip="terraform-provider-${name}_${version}_linux_${TARGETARCH}.zip"; \
        sums="terraform-provider-${name}_${version}_SHA256SUMS"; \
        mkdir -p "/out/${source}/${version}"; \
        curl -fsSL "$base/$sums" -o "/tmp/dl/$sums"; \
        curl -fsSL "$base/$zip"  -o "/tmp/dl/$zip"; \
        expected=$(grep " $zip\$" "/tmp/dl/$sums" | awk '{print $1}'); \
        actual=$(sha256sum "/tmp/dl/$zip" | awk '{print $1}'); \
        [ -n "$expected" ] && [ "$expected" = "$actual" ] || { echo "checksum mismatch for $zip" >&2; exit 1; }; \
        unzip -q "/tmp/dl/$zip" -d "/out/${source}/${version}"; \
      done; \
    done

# ── Stage 4: runtime ─────────────────────────────────────────────────────────
FROM node:24-bookworm-slim AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && groupadd -r opsy && useradd -r -g opsy -d /app -s /sbin/nologin opsy

# Nitro server at /app/server/index.mjs; the migrator resolves
# "../../../drizzle" from /app/server to /drizzle (path.resolve clamps at /).
WORKDIR /app
COPY --from=api-builder /repo/apps/api/.output/server /app/server
COPY --from=api-builder /repo/apps/api/drizzle /drizzle
COPY --from=bridge-builder /out/opsy-bridge /opt/opsy/bridge
COPY --from=provider-cache /out /opt/opsy/providers
RUN chmod +x /opt/opsy/bridge \
 && chown -R opsy:opsy /app /drizzle /opt/opsy

ENV OPSY_BRIDGE_BIN=/opt/opsy/bridge \
    OPSY_PROVIDER_DIR=/opt/opsy/providers \
    PORT=4000 \
    NODE_ENV=production

USER opsy
EXPOSE 4000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["sh", "-c", "if [ -z \"$WORKFLOW_POSTGRES_URL\" ]; then case \"$DATABASE_URL\" in *\\?*) export WORKFLOW_POSTGRES_URL=\"${DATABASE_URL}&uselibpqcompat=true\" ;; *) export WORKFLOW_POSTGRES_URL=\"${DATABASE_URL}?uselibpqcompat=true\" ;; esac; fi; node /app/server/node_modules/@workflow/world-postgres/bin/setup.js && exec node /app/server/index.mjs"]
