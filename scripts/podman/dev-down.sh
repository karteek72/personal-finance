#!/usr/bin/env bash
# Stop local dev API/UI and optionally Postgres container.
#
# Usage:
#   ./scripts/podman/dev-down.sh           # stop API, UI, and Postgres
#   ./scripts/podman/dev-down.sh --keep-db # stop API + UI only
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

KEEP_DB=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-db) KEEP_DB=1; shift ;;
    -h | --help)
      grep '^#' "$0" | head -6
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      exit 1
      ;;
  esac
done

spendflow_load_dev_env

echo "==> Stopping local API and UI"
spendflow_dev_stop_app_servers

if [[ "${KEEP_DB}" -eq 0 ]]; then
  spendflow_require_cmd podman
  if podman ps >/dev/null 2>&1; then
    echo "==> Stopping Postgres container"
    spendflow_dev_stop_postgres
  fi
fi

echo "Done."
