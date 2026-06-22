#!/usr/bin/env bash
# Build SpendFlow UI and API images for Podman.
# Usage: ./scripts/podman/build.sh [--version TAG] [compose build args...]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

spendflow_require_cmd podman
spendflow_load_env
if [[ ! -f "${SPENDFLOW_CONTAINERS_DIR}/deploy.env" ]]; then
  echo "warn: ${SPENDFLOW_CONTAINERS_DIR}/deploy.env missing — copy deploy.env.example (required for public HTTPS URLs)" >&2
fi
spendflow_parse_image_version_args "$@"
spendflow_apply_build_urls

echo "==> Building images"
echo "    Build target:          $(spendflow_infer_build_target)"
echo "    Image tag:             ${SPENDFLOW_IMAGE_TAG}"
echo "    UI API URL (baked in): ${NEXT_PUBLIC_API_URL}"
echo "    UI app URL:            ${NEXT_PUBLIC_APP_URL}"
echo "    Bind host:             ${SPENDFLOW_HOST}"
spendflow_print_deploy_urls

if ((${#SPENDFLOW_REMAINING_ARGS[@]})); then
  spendflow_compose build "${SPENDFLOW_REMAINING_ARGS[@]}"
else
  spendflow_podman_build_images
fi

echo "==> Done. Images:"
podman images --filter "reference=localhost/spendflow-*:${SPENDFLOW_IMAGE_TAG}" --format "  {{.Repository}}:{{.Tag}}  {{.Size}}"
