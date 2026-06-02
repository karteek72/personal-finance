#!/usr/bin/env bash
# Shared helpers for SpendFlow Podman scripts.

set -euo pipefail

spendflow_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "${script_dir}/../.." && pwd
}

spendflow_detect_lan_ip() {
  ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
}

spendflow_host_is_local() {
  local host="$1"
  local addr

  [[ "${host}" == "0.0.0.0" || "${host}" == "127.0.0.1" || "${host}" == "localhost" ]] && return 0

  while IFS= read -r addr; do
    [[ -n "${addr}" && "${addr}" == "${host}" ]] && return 0
  done < <(ifconfig 2>/dev/null | awk '/inet / {print $2}' | sed 's/addr://')

  return 1
}

spendflow_validate_host() {
  if spendflow_host_is_local "${SPENDFLOW_HOST}"; then
    return 0
  fi

  local detected
  detected="$(spendflow_detect_lan_ip)"
  echo "warn: SPENDFLOW_HOST=${SPENDFLOW_HOST} is not assigned on this machine" >&2
  if [[ -n "${detected}" ]]; then
    echo "warn: detected LAN IP ${detected} — update containers/deploy.env for Wi-Fi access" >&2
  fi
  echo "warn: binding 0.0.0.0 so deploy can start on this host" >&2
  export SPENDFLOW_HOST=0.0.0.0
}

spendflow_ensure_podman() {
  if podman ps >/dev/null 2>&1; then
    return 0
  fi

  echo "==> Starting Podman machine"
  if podman machine info >/dev/null 2>&1; then
    podman machine start >/dev/null 2>&1 || podman machine start
  else
    echo "error: no Podman machine found — run: podman machine init && podman machine start" >&2
    exit 1
  fi

  local i
  for ((i = 1; i <= 30; i++)); do
    if podman ps >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "warn: Podman socket still unavailable — restarting machine" >&2
  podman machine stop >/dev/null 2>&1 || true
  podman machine start >/dev/null 2>&1 || podman machine start

  for ((i = 1; i <= 30; i++)); do
    if podman ps >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "error: Podman machine did not become ready — run: podman machine stop && podman machine start" >&2
  exit 1
}

spendflow_load_env() {
  local root containers
  root="$(spendflow_repo_root)"
  containers="${root}/containers"

  export SPENDFLOW_REPO_ROOT="${root}"
  export SPENDFLOW_CONTAINERS_DIR="${containers}"

  if [[ -f "${root}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${root}/.env"
    set +a
  fi
  if [[ -f "${containers}/.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${containers}/.env"
    set +a
  fi
  # deploy.env last — CORS_ORIGINS and public URLs must win over dev .env
  if [[ -f "${containers}/deploy.env" ]]; then
    set -a
    # shellcheck disable=SC1091
    source "${containers}/deploy.env"
    set +a
  elif [[ -f "${containers}/deploy.env.example" ]]; then
    echo "warn: ${containers}/deploy.env missing — using deploy.env.example" >&2
    set -a
    # shellcheck disable=SC1091
    source "${containers}/deploy.env.example"
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

  spendflow_validate_host
}

spendflow_compose() {
  local containers
  containers="${SPENDFLOW_CONTAINERS_DIR}"
  spendflow_ensure_podman
  cd "${containers}"
  # podman-compose ignores COMPOSE_PROFILES; pass --profile explicitly when bundled DB is used.
  if [[ -n "${SPENDFLOW_COMPOSE_PROFILE:-}" ]]; then
    podman compose -f compose.yaml --profile "${SPENDFLOW_COMPOSE_PROFILE}" "$@"
  else
    podman compose -f compose.yaml "$@"
  fi
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
  unset SPENDFLOW_COMPOSE_PROFILE
  if [[ "${SPENDFLOW_EXTERNAL_POSTGRES:-false}" == "true" ]]; then
    local host_port="${POSTGRES_HOST_PORT:-5433}"
    export DATABASE_URL="postgresql://${POSTGRES_USER:-spendflow}:${POSTGRES_PASSWORD:-spendflow}@host.containers.internal:${host_port}/${POSTGRES_DB:-spendflow}"
    echo "info: using external postgres at host.containers.internal:${host_port}" >&2
    return 0
  fi
  export SPENDFLOW_COMPOSE_PROFILE=bundled-db
  export DATABASE_URL="postgresql://${POSTGRES_USER:-spendflow}:${POSTGRES_PASSWORD:-spendflow}@postgres:5432/${POSTGRES_DB:-spendflow}"
}

spendflow_wait_container_healthy() {
  local name="$1"
  local timeout="${2:-90}"
  local status

  for ((i = 0; i < timeout; i++)); do
    status="$(podman inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${name}" 2>/dev/null || echo missing)"
    if [[ "${status}" == "healthy" || "${status}" == "running" ]]; then
      return 0
    fi
    sleep 1
  done

  echo "warn: ${name} not ready after ${timeout}s (last status: ${status})" >&2
  return 1
}

spendflow_stop_port() {
  local port="$1"
  local pids

  if pids="$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null)"; then
    # shellcheck disable=SC2086
    kill ${pids} 2>/dev/null || true
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
