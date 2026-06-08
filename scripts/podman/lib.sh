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

spendflow_root_env_file() {
  echo "$(spendflow_repo_root)/.env"
}

spendflow_load_env() {
  local root containers root_env
  root="$(spendflow_repo_root)"
  containers="${root}/containers"
  root_env="$(spendflow_root_env_file)"

  export SPENDFLOW_REPO_ROOT="${root}"
  export SPENDFLOW_CONTAINERS_DIR="${containers}"

  if [[ ! -f "${root_env}" ]]; then
    echo "error: missing ${root_env} — copy from .env.example" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1091
  source "${root_env}"
  set +a
  # deploy.env last — host ports and public URLs override dev defaults
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
  : "${SPENDFLOW_UI_PORT:=3005}"
  : "${SPENDFLOW_API_PORT:=4000}"
  : "${SPENDFLOW_IMAGE_TAG:=latest}"
  export SPENDFLOW_IMAGE_TAG

  export NEXT_PUBLIC_GOOGLE_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-${GOOGLE_CLIENT_ID:-}}"
  export NEXT_PUBLIC_USE_MOCKS="${NEXT_PUBLIC_USE_MOCKS:-false}"

  # Backend invite links + SnapTrade callback (override dev localhost when deploy.env sets public URLs).
  export UI_APP_URL="${UI_APP_URL:-${NEXT_PUBLIC_APP_URL:-${SPENDFLOW_UI_PUBLIC_URL:-http://localhost:3002}}}"
  if [[ -z "${SNAPTRADE_REDIRECT_URI:-}" ]]; then
    export SNAPTRADE_REDIRECT_URI="${UI_APP_URL%/}/accounts/snaptrade/callback"
  fi

  spendflow_validate_host
  spendflow_resolve_runtime_cors
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

# Remaining CLI args after stripping -v/--version (see spendflow_parse_image_version_args).
SPENDFLOW_REMAINING_ARGS=()

spendflow_validate_image_tag() {
  if [[ ! "${SPENDFLOW_IMAGE_TAG}" =~ ^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$ ]]; then
    echo "error: invalid image tag '${SPENDFLOW_IMAGE_TAG}' (use letters, digits, ., _, -)" >&2
    exit 1
  fi
}

# Parse -v/--version from script args; CLI overrides SPENDFLOW_IMAGE_TAG from deploy.env.
spendflow_parse_image_version_args() {
  SPENDFLOW_REMAINING_ARGS=()
  while [[ $# -gt 0 ]]; do
    case "$1" in
      -v|--version)
        if [[ $# -lt 2 ]]; then
          echo "error: --version requires a value" >&2
          exit 1
        fi
        export SPENDFLOW_IMAGE_TAG="$2"
        shift 2
        ;;
      --version=*)
        export SPENDFLOW_IMAGE_TAG="${1#*=}"
        shift
        ;;
      *)
        SPENDFLOW_REMAINING_ARGS+=("$1")
        shift
        ;;
    esac
  done
  spendflow_validate_image_tag
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
  local env_file
  env_file="$(spendflow_root_env_file)"
  if grep -q '^JWT_SECRET=' "${env_file}" 2>/dev/null; then
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
    echo "error: ENCRYPTION_KEY missing. Set in repo root .env or install openssl." >&2
    return 1
  fi
  ENCRYPTION_KEY="$(openssl rand -hex 32)"
  export ENCRYPTION_KEY
  local env_file
  env_file="$(spendflow_root_env_file)"
  touch "${env_file}"
  if grep -qE '^[[:space:]]*ENCRYPTION_KEY=' "${env_file}" 2>/dev/null; then
    spendflow_sed_inplace "${env_file}" "s/^[[:space:]]*ENCRYPTION_KEY=.*/ENCRYPTION_KEY=${ENCRYPTION_KEY}/"
  else
    echo "ENCRYPTION_KEY=${ENCRYPTION_KEY}" >>"${env_file}"
  fi
  echo "warn: generated ENCRYPTION_KEY in ${env_file} (required for Plaid in production containers)" >&2
}

spendflow_strip_trailing_slash() {
  local url="$1"
  while [[ "${url}" == */ ]]; do
    url="${url%/}"
  done
  printf '%s' "${url}"
}

# public = bake HTTPS hostnames (Cloudflare tunnel). lan = bake LAN IP + published ports.
spendflow_infer_build_target() {
  if [[ -n "${SPENDFLOW_BUILD_TARGET:-}" ]]; then
    printf '%s' "${SPENDFLOW_BUILD_TARGET}"
    return 0
  fi
  if [[ "${SPENDFLOW_UI_PUBLIC_URL:-}" =~ ^https:// ]]; then
    printf 'public'
    return 0
  fi
  printf 'lan'
}

spendflow_lan_base_url() {
  local scheme="http"
  local host="${1:-}"
  local port="$2"
  if [[ -z "${host}" || "${host}" == "0.0.0.0" ]]; then
    host="$(spendflow_detect_lan_ip)"
  fi
  if [[ -z "${host}" ]]; then
    host="127.0.0.1"
  fi
  printf '%s://%s:%s' "${scheme}" "${host}" "${port}"
}

# Merge CORS origins for the API container (browser + tunnel + LAN).
spendflow_resolve_runtime_cors() {
  local -a origins=()
  local item origin

  if [[ -n "${CORS_ORIGINS:-}" ]]; then
    IFS=',' read -ra origins <<<"${CORS_ORIGINS}"
  fi

  spendflow_append_cors_origin() {
    local candidate
    candidate="$(spendflow_strip_trailing_slash "$1")"
    [[ -z "${candidate}" ]] && return 0
    for item in "${origins[@]}"; do
      item="$(spendflow_strip_trailing_slash "${item}")"
      if [[ "${item}" == "${candidate}" ]]; then
        return 0
      fi
    done
    origins+=("${candidate}")
  }

  spendflow_append_cors_origin "${SPENDFLOW_UI_PUBLIC_URL:-}"
  spendflow_append_cors_origin "${SPENDFLOW_UI_LAN_URL:-}"
  spendflow_append_cors_origin "$(spendflow_lan_base_url "${SPENDFLOW_HOST}" "${SPENDFLOW_UI_PORT}")"
  spendflow_append_cors_origin "http://localhost:${SPENDFLOW_UI_PORT}"
  spendflow_append_cors_origin "http://127.0.0.1:${SPENDFLOW_UI_PORT}"

  CORS_ORIGINS="$(IFS=,; printf '%s' "${origins[*]}")"
  export CORS_ORIGINS
}

# Set NEXT_PUBLIC_* baked into the static UI image. Only call from build.sh.
spendflow_apply_build_urls() {
  local target api_base app_base
  target="$(spendflow_infer_build_target)"

  case "${target}" in
    public)
      if [[ -z "${SPENDFLOW_API_PUBLIC_URL:-}" || -z "${SPENDFLOW_UI_PUBLIC_URL:-}" ]]; then
        echo "error: SPENDFLOW_BUILD_TARGET=public requires SPENDFLOW_API_PUBLIC_URL and SPENDFLOW_UI_PUBLIC_URL in containers/deploy.env" >&2
        exit 1
      fi
      api_base="$(spendflow_strip_trailing_slash "${SPENDFLOW_API_PUBLIC_URL}")"
      app_base="$(spendflow_strip_trailing_slash "${SPENDFLOW_UI_PUBLIC_URL}")"
      export NEXT_PUBLIC_API_URL="${api_base}/api/v1"
      export NEXT_PUBLIC_APP_URL="${app_base}"
      ;;
    lan)
      api_base="${SPENDFLOW_API_LAN_URL:-$(spendflow_lan_base_url "${SPENDFLOW_HOST}" "${SPENDFLOW_API_PORT}")}"
      app_base="${SPENDFLOW_UI_LAN_URL:-$(spendflow_lan_base_url "${SPENDFLOW_HOST}" "${SPENDFLOW_UI_PORT}")}"
      export NEXT_PUBLIC_API_URL="$(spendflow_strip_trailing_slash "${api_base}")/api/v1"
      export NEXT_PUBLIC_APP_URL="$(spendflow_strip_trailing_slash "${app_base}")"
      ;;
    *)
      echo "error: SPENDFLOW_BUILD_TARGET must be 'public' or 'lan' (got '${target}')" >&2
      exit 1
      ;;
  esac

  echo "info: UI build target=${target}" >&2
  echo "info:   NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}" >&2
  echo "info:   NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}" >&2

  if [[ "${target}" == "public" && "${NEXT_PUBLIC_API_URL}" != https://* ]]; then
    echo "warn: public build but NEXT_PUBLIC_API_URL is not HTTPS — browsers on ${NEXT_PUBLIC_APP_URL} may block API calls" >&2
  fi
}

spendflow_tunnel_upstream_host() {
  if [[ "${SPENDFLOW_HOST}" == "0.0.0.0" ]]; then
    spendflow_detect_lan_ip
  else
    printf '%s' "${SPENDFLOW_HOST}"
  fi
}

spendflow_print_deploy_urls() {
  local tunnel_host
  tunnel_host="$(spendflow_tunnel_upstream_host)"
  echo "    CORS_ORIGINS:          ${CORS_ORIGINS}"
  echo "    API APP_URL:           ${SPENDFLOW_API_PUBLIC_URL:-http://localhost:${SPENDFLOW_API_PORT}}"
  if [[ -n "${tunnel_host}" ]]; then
    echo "    Cloudflare upstream:   UI http://${tunnel_host}:${SPENDFLOW_UI_PORT}  API http://${tunnel_host}:${SPENDFLOW_API_PORT}"
  fi
  if [[ -n "${SPENDFLOW_UI_PUBLIC_URL:-}" ]]; then
    echo "    Public UI:             ${SPENDFLOW_UI_PUBLIC_URL}"
    echo "    Public API:            ${SPENDFLOW_API_PUBLIC_URL:-}/api/v1"
    echo "    Rebuild UI after URL changes: ./scripts/podman/build.sh && ./scripts/podman/deploy.sh"
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
  # Podman DNS resolves compose service names (postgres/redis) to 127.0.0.1 inside
  # containers; use container_name hostnames from compose.yaml instead.
  export DATABASE_URL="postgresql://${POSTGRES_USER:-spendflow}:${POSTGRES_PASSWORD:-spendflow}@spendflow-postgres:5432/${POSTGRES_DB:-spendflow}"
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

  export REDIS_URL="redis://spendflow-redis:6379"
  echo "info: container REDIS_URL=${REDIS_URL} (host bind port ${REDIS_HOST_PORT:-6380} is for local dev only)" >&2
}

# Host npm dev: always reach bundled Postgres/Redis via published ports (never mutate .env).
spendflow_apply_host_infra_urls() {
  export DATABASE_URL="postgresql://${POSTGRES_USER:-spendflow}:${POSTGRES_PASSWORD:-spendflow}@127.0.0.1:${POSTGRES_HOST_PORT:-5433}/${POSTGRES_DB:-spendflow}"
  export REDIS_URL="redis://127.0.0.1:${REDIS_HOST_PORT:-6380}"
}

# Values compose substitutes from the shell (see compose.yaml ${VAR} entries).
spendflow_export_compose_runtime_env() {
  spendflow_prepare_postgres
  spendflow_prepare_redis
  export DATABASE_URL REDIS_URL JWT_SECRET ENCRYPTION_KEY
  export CORS_ORIGINS NEXT_PUBLIC_API_URL NEXT_PUBLIC_APP_URL NEXT_PUBLIC_GOOGLE_CLIENT_ID
  export SPENDFLOW_HOST SPENDFLOW_UI_PORT SPENDFLOW_API_PORT SPENDFLOW_IMAGE_TAG
  export SPENDFLOW_UI_PUBLIC_URL SPENDFLOW_API_PUBLIC_URL
  spendflow_resolve_runtime_cors
  export PLAID_CLIENT_ID PLAID_SECRET PLAID_ENV PLAID_PRODUCTS PLAID_COUNTRY_CODES PLAID_REDIRECT_URI
  export GOOGLE_CLIENT_ID GOOGLE_CLIENT_IDS GOOGLE_SECRET_KEY AUTH_ALLOW_DEV_USER
  export TELLER_APPLICATION_ID TELLER_ENV TELLER_CERT_PATH TELLER_KEY_PATH
  export UI_APP_URL
  export SNAPTRADE_CLIENT_ID SNAPTRADE_CONSUMER_KEY SNAPTRADE_CLIENT_SECRET SNAPTRADE_REDIRECT_URI
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
  local root containers root_env
  root="$(spendflow_repo_root)"
  containers="${root}/containers"
  root_env="$(spendflow_root_env_file)"

  export SPENDFLOW_REPO_ROOT="${root}"
  export SPENDFLOW_CONTAINERS_DIR="${containers}"

  if [[ ! -f "${root_env}" ]]; then
    echo "error: missing ${root_env} — copy from .env.example" >&2
    exit 1
  fi
  set -a
  # shellcheck disable=SC1091
  source "${root_env}"
  set +a

  export SPENDFLOW_DEV_API_PORT="${SPENDFLOW_DEV_API_PORT:-4000}"
  export SPENDFLOW_DEV_UI_PORT="${SPENDFLOW_DEV_UI_PORT:-3002}"
  export POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-5433}"
  export REDIS_HOST_PORT="${REDIS_HOST_PORT:-6380}"

  spendflow_apply_host_infra_urls
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

  spendflow_ensure_jwt_secret
}

spendflow_dev_start_infra() {
  export SPENDFLOW_COMPOSE_PROFILE=bundled-db
  # Host API/UI use 127.0.0.1 — do not call spendflow_prepare_postgres (container DNS).
  spendflow_apply_host_infra_urls
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
    export TELLER_APPLICATION_ID TELLER_ENV TELLER_CERT_PATH TELLER_KEY_PATH
    export SNAPTRADE_CLIENT_ID SNAPTRADE_CONSUMER_KEY SNAPTRADE_CLIENT_SECRET SNAPTRADE_REDIRECT_URI
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
