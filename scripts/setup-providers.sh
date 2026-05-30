#!/usr/bin/env bash
# Download Terraform provider binaries for local testing.
# Mirrors the pattern used by Pulumi Bridge and HashiCorp provider repos.
#
# Usage:
#   ./scripts/setup-providers.sh
#
# Environment:
#   OPSY_TERRAFORM_PROVIDERS - comma-separated name=source@version entries.
#      Use | to install multiple versions for one source, e.g.
#      aws=hashicorp/aws@6.44.0|6.45.0
#   TF_PROVIDER_DIR       - where to install binaries (defaults to ./tf-providers)
#
set -euo pipefail

CATALOG="${OPSY_TERRAFORM_PROVIDERS:-aws=hashicorp/aws@6.44.0}"
DEST_DIR="${TF_PROVIDER_DIR:-$(cd "$(dirname "$0")/.." && pwd)/tf-providers}"
TMP_ROOT=$(mktemp -d)
trap 'rm -rf "$TMP_ROOT"' EXIT

# ── Platform detection ──────────────────────────────────────────────────────
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$ARCH" in
	x86_64)       ARCH=amd64 ;;
	aarch64|arm64) ARCH=arm64 ;;
	*) echo "ERROR: unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

# ── Provider-specific setup ─────────────────────────────────────────────────
setup_provider() {
	local SOURCE="$1"    # e.g. hashicorp/aws
	local VERSION="$2"   # e.g. 6.44.0
	local NAME="${SOURCE##*/}"  # e.g. aws

	local PROVIDER_DIR="$DEST_DIR/$SOURCE/$VERSION"
	mkdir -p "$PROVIDER_DIR"

	# Idempotent: skip if any executable already present
	if ls "$PROVIDER_DIR"/terraform-provider-"$NAME"* 1>/dev/null 2>&1; then
		echo "  terraform-provider-$NAME $VERSION already present — skipping"
		return 0
	fi

	local BASE_URL="https://releases.hashicorp.com/terraform-provider-$NAME/$VERSION"
	local ZIP_NAME="terraform-provider-${NAME}_${VERSION}_${OS}_${ARCH}.zip"
	local SUMS_NAME="terraform-provider-${NAME}_${VERSION}_SHA256SUMS"

	local TMP
	TMP=$(mktemp -d "$TMP_ROOT/provider.XXXXXX")

	echo "  Downloading SHA256SUMS..."
	curl -fsSL "$BASE_URL/$SUMS_NAME" -o "$TMP/$SUMS_NAME"

	echo "  Downloading $ZIP_NAME..."
	curl -fsSL --progress-bar "$BASE_URL/$ZIP_NAME" -o "$TMP/$ZIP_NAME"

	# Verify checksum — mirrors what `terraform init` does
	echo "  Verifying checksum..."
	local EXPECTED
	EXPECTED=$(grep " $ZIP_NAME\$" "$TMP/$SUMS_NAME" | awk '{print $1}')
	if [ -z "$EXPECTED" ]; then
		echo "ERROR: $ZIP_NAME not listed in SHA256SUMS" >&2
		exit 1
	fi

	local ACTUAL
	if command -v sha256sum &>/dev/null; then
		ACTUAL=$(sha256sum "$TMP/$ZIP_NAME" | awk '{print $1}')
	elif command -v shasum &>/dev/null; then
		ACTUAL=$(shasum -a 256 "$TMP/$ZIP_NAME" | awk '{print $1}')
	else
		echo "ERROR: sha256sum or shasum not found — cannot verify" >&2
		exit 1
	fi

	if [ "$EXPECTED" != "$ACTUAL" ]; then
		echo "ERROR: checksum mismatch for $ZIP_NAME" >&2
		echo "  expected: $EXPECTED" >&2
		echo "  actual:   $ACTUAL" >&2
		exit 1
	fi
	echo "  Checksum OK (sha256: ${EXPECTED:0:12}...)"

	# Extract and make executable
	echo "  Extracting to $PROVIDER_DIR..."
	unzip -q "$TMP/$ZIP_NAME" -d "$PROVIDER_DIR"
	chmod +x "$PROVIDER_DIR"/terraform-provider-"$NAME"*
	echo "  Installed: $(ls "$PROVIDER_DIR")"
}

# ── Run ─────────────────────────────────────────────────────────────────────
echo "Setting up Terraform providers in: $DEST_DIR"
echo ""
IFS=',' read -ra ENTRIES <<< "$CATALOG"
for ENTRY in "${ENTRIES[@]}"; do
	ENTRY="$(echo "$ENTRY" | xargs)"
	[ -n "$ENTRY" ] || continue
	REF="${ENTRY#*=}"
	SOURCE="${REF%@*}"
	VERSION_LIST="${REF##*@}"
	if [ -z "$SOURCE" ] || [ "$SOURCE" = "$REF" ] || [ -z "$VERSION_LIST" ]; then
		echo "ERROR: invalid OPSY_TERRAFORM_PROVIDERS entry: $ENTRY" >&2
		exit 1
	fi
	IFS='|' read -ra VERSIONS <<< "$VERSION_LIST"
	for VERSION in "${VERSIONS[@]}"; do
		VERSION="$(echo "$VERSION" | xargs)"
		if [ -z "$VERSION" ]; then
			echo "ERROR: invalid OPSY_TERRAFORM_PROVIDERS entry: $ENTRY" >&2
			exit 1
		fi
		echo "$SOURCE $VERSION"
		setup_provider "$SOURCE" "$VERSION"
	done
	echo ""
done
echo ""
echo "Done."
