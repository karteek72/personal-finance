#!/usr/bin/env bash
# Shared helpers for SpendFlow Podman scripts.

set -euo pipefail

spendflow_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "${script_dir}/../.." && pwd
}

spendflow_load_env() {
  local root containers
  root="$(spendflow_repo_root)"
  containers="${root}/containers"

  export SPENDFLOW_REPO_ROOT="${root}"
  export SPENDFLOW_CONTAINERS_DIR="${containers}"

  if [[ -f "${containers}/deploy.env" ]]; then
    # shellcheck disable=SC1091
    set -a
    source "${containers}/deploy.env"
    set +a
  elif [[ -f "${containers}/deploy.env.example" ]]; then
    echo "warn: ${containers}/deploy.env missing — using deploy.env.example" >&2
    set -a
    source "${containers}/deploy.env.example"
    set +a
  fi

  if [[ -f "${root}/.env" ]]; then
    set -a
    source "${root}/.env"
    set +a
  fi
  if [[ -f "${containers}/.env" ]]; then
    set -a
    source "${containers}/.env"
    set +a
  fi

  : "${SPENDFLOW_HOST:=0.0.0.0}"
  : "${SPENDFLOW_UI_PORT:=3000}"
  : "${SPENDFLOW_API_PORT:=4000}"

  export NEXT_PUBLIC_GOOGLE_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-${GOOGLE_CLIENT_ID:-}}"
  export CORS_ORIGINS="${CORS_ORIGINS:-${SPENDFLOW_UI_PUBLIC_URL:-http://localhost:3000},${SPENDFLOW_UI_LAN_URL:-http://127.0.0.1:3000}}"
  export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-${SPENDFLOW_API_PUBLIC_URL:-http://localhost:4000}/api/v1}"
  export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-${SPENDFLOW_UI_PUBLIC_URL:-http://localhost:3000}}"
  export NEXT_PUBLIC_USE_MOCKS="${NEXT_PUBLIC_USE_MOCKS:-false}"
}

spendflow_compose() {
  local containers
  containers="${SPENDFLOW_CONTAINERS_DIR}"
  cd "${containers}"
  podman compose -f compose.yaml "$@"
}

spendflow_require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "error: '$1' not found. Install Podman and podman-compose." >&2
    exit 1
  fi
}

spendflow_ensure_jwt_secret() {
  if [[ -n "${JWT_SECRET:-}" && "${#JWT_SECRET}" -ge 16 ]]; then
    return 0
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    echo "error: JWT_SECRET missing (16+ chars). Set in .env or install openssl." >&2
    return 1
  fi
  JWT_SECRET="$(openssl rand -hex 32)"
  export JWT_SECRET
  local env_file="${SPENDFLOW_CONTAINERS_DIR}/.env"
  if [[ -f "${env_file}" ]] && grep -q '^JWT_SECRET=' "${env_file}" 2>/dev/null; then
    return 0
  fi
  echo "JWT_SECRET=${JWT_SECRET}" >>"${env_file}"
  echo "warn: generated JWT_SECRET in ${env_file}" >&2
}

spendflow_use_lan_build_urls() {
  [[ "${SPENDFLOW_BUILD_TARGET:-lan}" != "public" ]]
}

spendflow_apply_build_urls() {
  if spendflow_use_lan_build_urls; then
    export NEXT_PUBLIC_API_URL="${SPENDFLOW_API_LAN_URL:-http://127.0.0.1:4000}/api/v1"
    export NEXT_PUBLIC_APP_URL="${SPENDFLOW_UI_LAN_URL:-http://127.0.0.1:3000}"
    echo "info: building UI for LAN (${NEXT_PUBLIC_APP_URL})" >&2
  fi
}

spendflow_prepare_postgres() {
  if [[ "${SPENDFLOW_BUNDLED_POSTGRES:-false}" == "true" ]]; then
    export COMPOSE_PROFILES="${COMPOSE_PROFILES:+$COMPOSE_PROFILES,}bundled-db"
    export DATABASE_URL="postgresql://${POSTGRES_USER:-spendflow}:${POSTGRES_PASSWORD:-spendflow}@postgres:5432/${POSTGRES_DB:-spendflow}"
    return 0
  fi
  if podman ps --format '{{.Names}}' 2>/dev/null | grep -qx 'spendflow-postgres'; then
    local host_port="${POSTGRES_HOST_PORT:-5433}"
    export DATABASE_URL="postgresql://${POSTGRES_USER:-spendflow}:${POSTGRES_PASSWORD:-spendflow}@host.containers.internal:${host_port}/${POSTGRES_DB:-spendflow}"
    echo "info: using host postgres (spendflow-postgres → 127.0.0.1:${host_port})" >&2
    return 0
  fi
  export COMPOSE_PROFILES="${COMPOSE_PROFILES:+$COMPOSE_PROFILES,}bundled-db"
  export DATABASE_URL="postgresql://${POSTGRES_USER:-spendflow}:${POSTGRES_PASSWORD:-spendflow}@postgres:5432/${POSTGRES_DB:-spendflow}"
}

spendflow_stop_port() {
  local port="$1"
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
}

spendflow_stop_dev_servers() {
  if [[ "${SPENDFLOW_STOP_DEV:-true}" != "true" ]]; then
    return 0
  fi
  echo "==> Freeing ports ${SPENDFLOW_API_PORT} and ${SPENDFLOW_UI_PORT} (stop npm dev if running)"
  spendflow_stop_port "${SPENDFLOW_API_PORT}"
  spendflow_stop_port "${SPENDFLOW_UI_PORT}"
  sleep 1
}
