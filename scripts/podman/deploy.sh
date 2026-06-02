#!/usr/bin/env bash
# Build (if needed) and start the SpendFlow Podman stack.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

spendflow_require_cmd podman

BUILD=1
EXTRA_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-build) BUILD=0; shift ;;
    *) EXTRA_ARGS+=("$1"); shift ;;
  esac
done

spendflow_load_env

if [[ ! -f "${SPENDFLOW_CONTAINERS_DIR}/.env" && ! -f "${SPENDFLOW_REPO_ROOT}/.env" ]]; then
  echo "error: create ${SPENDFLOW_CONTAINERS_DIR}/.env from env.example (or use repo root .env)" >&2
  exit 1
fi

touch "${SPENDFLOW_CONTAINERS_DIR}/.env"
spendflow_ensure_jwt_secret
spendflow_prepare_postgres
spendflow_apply_build_urls
spendflow_stop_dev_servers

if [[ "${BUILD}" -eq 1 ]]; then
  "${SCRIPT_DIR}/build.sh"
fi

spendflow_ensure_podman

echo "==> Starting stack on ${SPENDFLOW_HOST}:${SPENDFLOW_UI_PORT} (UI) and :${SPENDFLOW_API_PORT} (API)"

UP_ARGS=(up -d --remove-orphans)
if [[ "${BUILD}" -eq 0 ]]; then
  UP_ARGS+=(--no-build)
fi
if ((${#EXTRA_ARGS[@]})); then
  spendflow_compose "${UP_ARGS[@]}" "${EXTRA_ARGS[@]}"
else
  spendflow_compose "${UP_ARGS[@]}"
fi

if [[ -n "${SPENDFLOW_COMPOSE_PROFILE:-}" ]]; then
  spendflow_wait_container_healthy spendflow-postgres 90 || true
  spendflow_compose up -d --no-build api ui 2>/dev/null || spendflow_compose up -d api ui
fi

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
