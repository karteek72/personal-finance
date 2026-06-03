#!/usr/bin/env bash
# Shared helpers for SpendFlow Podman scripts.

set -euo pipefail

spendflow_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  cd "${script_dir}/../.." && pwd
}

spendflow_detect_lan_ip() {
  local ip=""

  if command -v ip >/dev/null 2>&1; then
    ip="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}')"
    [[ -n "${ip}" ]] && echo "${ip}" && return 0
  fi

  if [[ "$(uname -s 2>/dev/null)" == "Darwin" ]] && command -v ipconfig >/dev/null 2>&1; then
    ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
    [[ -n "${ip}" ]] && echo "${ip}" && return 0
  fi

  if command -v hostname >/dev/null 2>&1; then
    ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
    [[ -n "${ip}" ]] && echo "${ip}" && return 0
  fi

  return 0
}

spendflow_host_is_local() {
  local host="$1"
  local addr

  [[ "${host}" == "0.0.0.0" || "${host}" == "127.0.0.1" || "${host}" == "localhost" ]] && return 0

  if command -v ip >/dev/null 2>&1; then
    while IFS= read -r addr; do
      [[ -n "${addr}" && "${addr}" == "${host}" ]] && return 0
    done < <(ip -4 addr show 2>/dev/null | awk '/inet / {print $2}' | cut -d/ -f1)
  fi

  while IFS= read -r addr; do
    [[ -n "${addr}" && "${addr}" == "${host}" ]] && return 0
  done < <(ifconfig 2>/dev/null | awk '/inet / {print $2}' | sed 's/addr://')

  return 1
}

spendflow_sed_inplace() {
  local file="$1"
  local pattern="$2"

  if sed --version >/dev/null 2>&1; then
    sed -i -e "${pattern}" "${file}"
  else
    sed -i '' -e "${pattern}" "${file}"
  fi
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

  if podman machine info >/dev/null 2>&1; then
    echo "==> Starting Podman machine" >&2
    podman machine start 2>/dev/null || true
  else
    echo "error: no Podman machine found — run: podman machine init && podman machine start" >&2
    exit 1
  fi

  local i
  for ((i = 1; i <= 45; i++)); do
    if podman ps >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "warn: Podman socket still unavailable — restarting machine" >&2
  podman machine stop 2>/dev/null || true
  sleep 2
  podman machine start 2>/dev/null || true

  for ((i = 1; i <= 45; i++)); do
    if podman ps >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done

  echo "error: Podman did not become ready — run: podman machine stop && podman machine start" >&2
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

# Plaid access tokens are encrypted at rest; production containers set NODE_ENV=production.
spendflow_ensure_encryption_key() {
  if [[ -n "${ENCRYPTION_KEY:-}" ]]; then
    return 0
  fi
  if ! command -v openssl >/dev/null 2>&1; then
    echo "error: ENCRYPTION_KEY missing. Set in containers/.env or install openssl." >&2
    return 1
  fi
  ENCRYPTION_KEY="$(openssl rand -hex 32)"
  export ENCRYPTION_KEY
  local env_file="${SPENDFLOW_CONTAINERS_DIR}/.env"
  touch "${env_file}"
  if grep -qE '^[[:space:]]*ENCRYPTION_KEY=' "${env_file}" 2>/dev/null; then
    spendflow_sed_inplace "${env_file}" "s/^[[:space:]]*ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${ENCRYPTION_KEY}/"
  else
    echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}" >>"${env_file}"
  fi
  echo "warn: generated ENCRYPTION_KEY in ${env_file} (required for Plaid in production containers)" >&2
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
  spendflow_write_container_env_var DATABASE_URL "${DATABASE_URL}"
}

spendflow_write_container_env_var() {
  local key="$1"
  local value="$2"
  local env_file="${SPENDFLOW_CONTAINERS_DIR}/.env"

  touch "${env_file}"
  if grep -qE "^[[:space:]]*${key}=" "${env_file}" 2>/dev/null; then
    spendflow_sed_inplace "${env_file}" "s|^[[:space:]]*${key}=.*|${key}=${value}|"
  else
    echo "${key}=${value}" >>"${env_file}"
  fi
}

# Container API/worker must reach Redis on spendflow-net — not localhost from dev .env.
spendflow_prepare_redis() {
  if [[ "${SPENDFLOW_EXTERNAL_REDIS:-false}" == "true" ]]; then
    if [[ -z "${REDIS_URL:-}" ]]; then
      echo "error: REDIS_URL required when SPENDFLOW_EXTERNAL_REDIS=true" >&2
      exit 1
    fi
    return 0
  fi

  export REDIS_URL="redis://redis:6379"
  spendflow_write_container_env_var REDIS_URL "${REDIS_URL}"
  echo "info: container REDIS_URL=${REDIS_URL} (host bind port ${REDIS_HOST_PORT:-6380} is for local dev only)" >&2
}

# Values compose substitutes from the shell (see compose.yaml ${VAR} entries).
spendflow_export_compose_runtime_env() {
  spendflow_prepare_postgres
  spendflow_prepare_redis
  export DATABASE_URL REDIS_URL JWT_SECRET ENCRYPTION_KEY
  export CORS_ORIGINS NEXT_PUBLIC_API_URL NEXT_PUBLIC_APP_URL NEXT_PUBLIC_GOOGLE_CLIENT_ID
  export SPENDFLOW_HOST SPENDFLOW_UI_PORT SPENDFLOW_API_PORT
  export SPENDFLOW_UI_PUBLIC_URL SPENDFLOW_API_PUBLIC_URL
  export PLAID_CLIENT_ID PLAID_SECRET PLAID_ENV PLAID_PRODUCTS PLAID_COUNTRY_CODES PLAID_REDIRECT_URI
  export GOOGLE_CLIENT_ID GOOGLE_CLIENT_IDS GOOGLE_SECRET_KEY AUTH_ALLOW_DEV_USER
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

# --- Local development (Postgres in Podman, API + UI on host) ---

spendflow_dev_logs_dir() {
  echo "${SPENDFLOW_REPO_ROOT}/logs/dev"
}

spendflow_load_dev_env() {
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

  export SPENDFLOW_DEV_API_PORT="${SPENDFLOW_DEV_API_PORT:-4000}"
  export SPENDFLOW_DEV_UI_PORT="${SPENDFLOW_DEV_UI_PORT:-3002}"
  export POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-5433}"
  export REDIS_HOST_PORT="${REDIS_HOST_PORT:-6380}"

  export DATABASE_URL="postgresql://${POSTGRES_USER:-spendflow}:${POSTGRES_PASSWORD:-spendflow}@127.0.0.1:${POSTGRES_HOST_PORT}/${POSTGRES_DB:-spendflow}"
  export REDIS_URL="redis://127.0.0.1:${REDIS_HOST_PORT}"
  export PORT="${SPENDFLOW_DEV_API_PORT}"
  export NODE_ENV=development
  export AUTH_ALLOW_DEV_USER="${AUTH_ALLOW_DEV_USER:-true}"
  export CORS_ORIGIN="http://localhost:${SPENDFLOW_DEV_UI_PORT}"
  export CORS_ORIGINS="http://localhost:${SPENDFLOW_DEV_UI_PORT},http://127.0.0.1:${SPENDFLOW_DEV_UI_PORT}"

  export APP_URL="http://localhost:${SPENDFLOW_DEV_API_PORT}"
  export NEXT_PUBLIC_API_URL="http://localhost:${SPENDFLOW_DEV_API_PORT}/api/v1"
  export NEXT_PUBLIC_APP_URL="http://localhost:${SPENDFLOW_DEV_UI_PORT}"
  export NEXT_PUBLIC_USE_MOCKS="${NEXT_PUBLIC_USE_MOCKS:-false}"
  export NEXT_PUBLIC_GOOGLE_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-${GOOGLE_CLIENT_ID:-}}"

  touch "${containers}/.env"
  spendflow_ensure_jwt_secret
}

spendflow_dev_start_infra() {
  export SPENDFLOW_COMPOSE_PROFILE=bundled-db
  spendflow_prepare_postgres
  echo "==> Starting Postgres + Redis (containers on spendflow-net)"
  echo "    Postgres: 127.0.0.1:${POSTGRES_HOST_PORT} (volume spendflow-pgdata)"
  echo "    Redis:    127.0.0.1:${REDIS_HOST_PORT} (volume spendflow-redisdata)"
  spendflow_compose up -d postgres redis
  spendflow_wait_container_healthy spendflow-postgres 90
  spendflow_wait_container_healthy spendflow-redis 60
  echo "    DATABASE_URL=${DATABASE_URL}"
  echo "    REDIS_URL=${REDIS_URL}"
}

spendflow_dev_start_postgres() {
  spendflow_dev_start_infra
}

spendflow_dev_stop_infra() {
  export SPENDFLOW_COMPOSE_PROFILE=bundled-db
  spendflow_compose stop postgres redis 2>/dev/null || true
}

spendflow_dev_stop_postgres() {
  spendflow_dev_stop_infra
}

spendflow_dev_pid_file() {
  echo "$(spendflow_dev_logs_dir)/$1.pid"
}

spendflow_dev_log_file() {
  echo "$(spendflow_dev_logs_dir)/$1.log"
}

spendflow_dev_is_running() {
  local pid_file
  pid_file="$(spendflow_dev_pid_file "$1")"
  if [[ ! -f "${pid_file}" ]]; then
    return 1
  fi
  local pid
  pid="$(cat "${pid_file}")"
  kill -0 "${pid}" 2>/dev/null
}

spendflow_dev_stop_process() {
  local name="$1"
  local pid_file
  pid_file="$(spendflow_dev_pid_file "${name}")"
  if [[ -f "${pid_file}" ]]; then
    local pid
    pid="$(cat "${pid_file}")"
    if kill -0 "${pid}" 2>/dev/null; then
      kill "${pid}" 2>/dev/null || true
      wait "${pid}" 2>/dev/null || true
    fi
    rm -f "${pid_file}"
  fi
  spendflow_stop_port "$2"
}

spendflow_dev_stop_app_servers() {
  spendflow_dev_stop_process api "${SPENDFLOW_DEV_API_PORT:-4000}"
  spendflow_dev_stop_process ui "${SPENDFLOW_DEV_UI_PORT:-3002}"
}

spendflow_dev_require_node() {
  if ! command -v npm >/dev/null 2>&1; then
    echo "error: npm not found — install Node.js 22+" >&2
    exit 1
  fi
  if [[ ! -d "${SPENDFLOW_REPO_ROOT}/backend/node_modules" ]]; then
    echo "error: run: cd backend && npm install" >&2
    exit 1
  fi
  if [[ ! -d "${SPENDFLOW_REPO_ROOT}/ui/node_modules" ]]; then
    echo "error: run: cd ui && npm install" >&2
    exit 1
  fi
}

spendflow_dev_start_api() {
  local log_file pid_file
  log_file="$(spendflow_dev_log_file api)"
  pid_file="$(spendflow_dev_pid_file api)"

  if spendflow_dev_is_running api; then
    echo "info: backend already running (pid $(cat "${pid_file}"))" >&2
    return 0
  fi

  spendflow_stop_port "${SPENDFLOW_DEV_API_PORT}"
  echo "==> Starting backend on http://localhost:${SPENDFLOW_DEV_API_PORT} (log: ${log_file})"
  (
    cd "${SPENDFLOW_REPO_ROOT}/backend"
    export DATABASE_URL PORT NODE_ENV AUTH_ALLOW_DEV_USER CORS_ORIGIN CORS_ORIGINS APP_URL REDIS_URL
    export JWT_SECRET PLAID_CLIENT_ID PLAID_SECRET PLAID_ENV PLAID_PRODUCTS PLAID_COUNTRY_CODES
    export PLAID_REDIRECT_URI ENCRYPTION_KEY GOOGLE_CLIENT_ID GOOGLE_CLIENT_IDS GOOGLE_SECRET_KEY
    npm run dev >>"${log_file}" 2>&1
  ) &
  echo $! >"${pid_file}"
}

spendflow_dev_start_ui() {
  local log_file pid_file
  log_file="$(spendflow_dev_log_file ui)"
  pid_file="$(spendflow_dev_pid_file ui)"

  if spendflow_dev_is_running ui; then
    echo "info: UI already running (pid $(cat "${pid_file}"))" >&2
    return 0
  fi

  spendflow_stop_port "${SPENDFLOW_DEV_UI_PORT}"
  echo "==> Starting UI on http://localhost:${SPENDFLOW_DEV_UI_PORT} (log: ${log_file})"
  (
    cd "${SPENDFLOW_REPO_ROOT}/ui"
    export NEXT_PUBLIC_API_URL NEXT_PUBLIC_APP_URL NEXT_PUBLIC_USE_MOCKS NEXT_PUBLIC_GOOGLE_CLIENT_ID
    npm run dev >>"${log_file}" 2>&1
  ) &
  echo $! >"${pid_file}"
}

spendflow_dev_wait_for_api() {
  local port="${SPENDFLOW_DEV_API_PORT:-4000}"
  local i
  for ((i = 0; i < 60; i++)); do
    if curl -sf "http://127.0.0.1:${port}/api/v1/health" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  echo "warn: API health check did not pass — see $(spendflow_dev_log_file api)" >&2
  return 1
}

spendflow_dev_print_urls() {
  cat <<EOF

Dev stack:
  UI:       http://localhost:${SPENDFLOW_DEV_UI_PORT}
  API:      http://localhost:${SPENDFLOW_DEV_API_PORT}/api/v1/health
  Postgres: 127.0.0.1:${POSTGRES_HOST_PORT} (container spendflow-postgres, volume spendflow-pgdata)
  Redis:    127.0.0.1:${REDIS_HOST_PORT} (container spendflow-redis, volume spendflow-redisdata)

Logs:
  $(spendflow_dev_log_file api)
  $(spendflow_dev_log_file ui)

Commands:
  ./scripts/podman/dev-logs.sh       # follow API + UI logs
  ./scripts/podman/dev-logs.sh -f postgres
  ./scripts/podman/dev-logs.sh -f redis
  ./scripts/podman/dev-down.sh       # stop API, UI, Postgres, and Redis

EOF
}
