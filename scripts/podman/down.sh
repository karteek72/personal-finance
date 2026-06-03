#!/usr/bin/env bash
# Stop the SpendFlow Podman stack.
#
# Usage:
#   ./scripts/podman/down.sh           # stop app containers (api, worker, ui)
#   ./scripts/podman/down.sh --all     # also stop Postgres and Redis
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

ALL=0
EXTRA_ARGS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) ALL=1; shift ;;
    -h | --help)
      sed -n '2,7p' "$0"
      exit 0
      ;;
    *) EXTRA_ARGS+=("$1"); shift ;;
  esac
done

spendflow_require_cmd podman
spendflow_load_env

if [[ "${ALL}" -eq 1 ]]; then
  spendflow_prepare_postgres
  echo "==> Stopping full stack (api, worker, ui, Postgres, Redis)"
  if ((${#EXTRA_ARGS[@]})); then
    spendflow_compose down "${EXTRA_ARGS[@]}"
  else
    spendflow_compose down
  fi
else
  echo "==> Stopping app containers (api, worker, ui)"
  echo "    Postgres and Redis keep running — pass --all to stop infra too"
  spendflow_compose stop api worker ui 2>/dev/null || true
  spendflow_compose rm -f api worker ui 2>/dev/null || true
fi
