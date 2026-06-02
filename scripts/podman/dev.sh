#!/usr/bin/env bash
# Local dev: Postgres in Podman; API + UI on the host with logs under logs/dev/
#
# Usage:
#   ./scripts/podman/dev.sh              # start all, then follow API + UI logs
#   ./scripts/podman/dev.sh --detach     # start in background (no log follow)
#   ./scripts/podman/dev.sh --postgres-only
#   ./scripts/podman/dev.sh --no-postgres   # API + UI only (Postgres already up)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

DETACH=0
START_POSTGRES=1
START_APPS=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --detach | -d) DETACH=1; shift ;;
    --postgres-only) START_APPS=0; shift ;;
    --no-postgres) START_POSTGRES=0; shift ;;
    -h | --help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      exit 1
      ;;
  esac
done

spendflow_require_cmd podman
spendflow_ensure_podman
spendflow_load_dev_env
spendflow_dev_require_node

mkdir -p "$(spendflow_dev_logs_dir)"

if [[ "${START_POSTGRES}" -eq 1 ]]; then
  spendflow_dev_start_postgres
fi

if [[ "${START_APPS}" -eq 1 ]]; then
  spendflow_dev_start_api
  spendflow_dev_start_ui
  spendflow_dev_wait_for_api || true
fi

spendflow_dev_print_urls

if [[ "${DETACH}" -eq 1 ]]; then
  exit 0
fi

if [[ "${START_APPS}" -eq 1 ]]; then
  echo "==> Following dev logs (Ctrl+C stops tail only; run dev-down.sh to stop servers)"
  # shellcheck disable=SC2064
  trap 'echo ""; echo "Stopped following logs (API/UI still running)"' INT TERM
  tail -n 30 -f "$(spendflow_dev_log_file api)" "$(spendflow_dev_log_file ui)"
fi
