#!/usr/bin/env bash
# Smoke-check SpendFlow container config, images, and HTTP endpoints.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

FAIL=0

fail() {
  echo "error: $*" >&2
  FAIL=1
}

warn() {
  echo "warn: $*" >&2
}

ok() {
  echo "ok: $*"
}

spendflow_require_cmd podman
spendflow_require_cmd curl
spendflow_load_env
spendflow_parse_image_version_args "$@"
spendflow_export_compose_runtime_env

echo "==> SpendFlow container verify"
echo "    Host bind: ${SPENDFLOW_HOST}:${SPENDFLOW_UI_PORT} (UI), :${SPENDFLOW_API_PORT} (API)"
echo "    DATABASE_URL host: $(echo "${DATABASE_URL}" | sed -E 's#(postgresql://[^@]+@)[^/]+#\1<host>#')"
echo "    REDIS_URL: ${REDIS_URL}"

if [[ ! -f "$(spendflow_root_env_file)" ]]; then
  fail "missing $(spendflow_root_env_file) (copy from .env.example)"
fi

if [[ -z "${JWT_SECRET:-}" || "${#JWT_SECRET}" -lt 16 ]]; then
  fail "JWT_SECRET missing or shorter than 16 characters"
else
  ok "JWT_SECRET present"
fi

if [[ -z "${ENCRYPTION_KEY:-}" ]]; then
  fail "ENCRYPTION_KEY missing (required for production API/worker)"
else
  ok "ENCRYPTION_KEY present"
fi

if [[ -z "${PLAID_CLIENT_ID:-}" || -z "${PLAID_SECRET:-}" ]]; then
  warn "PLAID_CLIENT_ID / PLAID_SECRET not set — Plaid Link will fail"
else
  ok "Plaid credentials present"
fi

echo "    Image tag: ${SPENDFLOW_IMAGE_TAG}"

for img in "localhost/spendflow-api:${SPENDFLOW_IMAGE_TAG}" "localhost/spendflow-ui:${SPENDFLOW_IMAGE_TAG}"; do
  if podman image exists "${img}" 2>/dev/null; then
    ok "image ${img}"
  else
    fail "image missing: ${img} (run ./scripts/podman/build.sh)"
  fi
done

spendflow_ensure_podman

check_http() {
  local name="$1"
  local url="$2"
  if curl -sf "${url}" >/dev/null 2>&1; then
    ok "${name} ${url}"
  else
    fail "${name} not reachable at ${url} (run ./scripts/podman/deploy.sh)"
  fi
}

# Use loopback for checks even when SPENDFLOW_HOST is 0.0.0.0
check_http "API health" "http://127.0.0.1:${SPENDFLOW_API_PORT}/api/v1/health"
check_http "UI" "http://127.0.0.1:${SPENDFLOW_UI_PORT}/"

if [[ -n "${SPENDFLOW_API_PUBLIC_URL:-}" ]] && podman container exists spendflow-ui 2>/dev/null; then
  api_host="${SPENDFLOW_API_PUBLIC_URL#https://}"
  api_host="${api_host#http://}"
  api_host="${api_host%%/*}"
  if podman exec spendflow-ui sh -c "grep -rq '${api_host}' /usr/share/nginx/html 2>/dev/null"; then
    ok "UI static bundle references public API host (${api_host})"
  else
    fail "UI bundle missing ${api_host} — rebuild: SPENDFLOW_BUILD_TARGET=public ./scripts/podman/build.sh && ./scripts/podman/deploy.sh --build"
  fi
fi

for c in spendflow-postgres spendflow-redis spendflow-api spendflow-worker spendflow-ui; do
  if podman container exists "${c}" 2>/dev/null; then
    status="$(podman inspect --format '{{.State.Status}}' "${c}" 2>/dev/null || echo unknown)"
    ok "container ${c} (${status})"
  else
    warn "container ${c} not running (deploy stack first)"
  fi
done

if [[ "${FAIL}" -ne 0 ]]; then
  exit 1
fi

echo ""
echo "All checks passed."
