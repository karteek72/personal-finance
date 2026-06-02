#!/usr/bin/env bash
# Build SpendFlow UI and API images for Podman.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

spendflow_require_cmd podman
spendflow_load_env
spendflow_apply_build_urls

echo "==> Building images"
echo "    UI API URL (baked in): ${NEXT_PUBLIC_API_URL}"
echo "    UI app URL:            ${NEXT_PUBLIC_APP_URL}"
echo "    Bind host:             ${SPENDFLOW_HOST}"

spendflow_compose build "$@"

echo "==> Done. Images:"
podman images --filter "reference=localhost/spendflow-*" --format "  {{.Repository}}:{{.Tag}}  {{.Size}}"
