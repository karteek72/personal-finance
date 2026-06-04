#!/usr/bin/env bash
# Start the SpendFlow Podman stack (images must exist — run build.sh first, or pass --build).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

spendflow_require_cmd podman

BUILD=0
EXTRA_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --build) BUILD=1; shift ;;
    --no-build)
      echo "warn: --no-build is the default; use --build to rebuild images" >&2
      shift
      ;;
    *) EXTRA_ARGS+=("$1"); shift ;;
  esac
done

spendflow_load_env

if [[ ! -f "$(spendflow_root_env_file)" ]]; then
  echo "error: create $(spendflow_root_env_file) from .env.example" >&2
  exit 1
fi
spendflow_ensure_jwt_secret
spendflow_ensure_encryption_key
spendflow_export_compose_runtime_env
spendflow_apply_build_urls
spendflow_stop_dev_servers

if [[ "${BUILD}" -eq 1 ]]; then
  "${SCRIPT_DIR}/build.sh"
fi

spendflow_ensure_podman

echo "==> Starting stack on ${SPENDFLOW_HOST}:${SPENDFLOW_UI_PORT} (UI) and :${SPENDFLOW_API_PORT} (API)"

UP_ARGS=(up -d --remove-orphans --no-build)
if ((${#EXTRA_ARGS[@]})); then
  spendflow_compose "${UP_ARGS[@]}" "${EXTRA_ARGS[@]}"
else
  spendflow_compose "${UP_ARGS[@]}"
fi

spendflow_wait_container_healthy spendflow-api 90 || true

echo ""
echo "LAN:"
echo "  UI:  http://${SPENDFLOW_HOST}:${SPENDFLOW_UI_PORT}"
echo "  API: http://${SPENDFLOW_HOST}:${SPENDFLOW_API_PORT}/api/v1/health"
if [[ -n "${SPENDFLOW_UI_PUBLIC_URL:-}" ]]; then
  echo "Public (host systemd cloudflared → same ports):"
  echo "  UI:  ${SPENDFLOW_UI_PUBLIC_URL}"
  echo "  API: ${SPENDFLOW_API_PUBLIC_URL}/api/v1"
  echo "  Tunnel upstream: http://${SPENDFLOW_HOST}:${SPENDFLOW_UI_PORT} and :${SPENDFLOW_API_PORT}"
fi
echo ""
spendflow_compose ps
