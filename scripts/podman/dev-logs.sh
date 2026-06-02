#!/usr/bin/env bash
# View local dev logs (API/UI files or Postgres container).
#
# Usage:
#   ./scripts/podman/dev-logs.sh              # follow API + UI
#   ./scripts/podman/dev-logs.sh --no-follow  # print last lines and exit
#   ./scripts/podman/dev-logs.sh postgres     # Postgres container only
#   ./scripts/podman/dev-logs.sh api ui       # subset
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "${SCRIPT_DIR}/lib.sh"

FOLLOW=1
TARGETS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f | --follow) FOLLOW=1; shift ;;
    --no-follow) FOLLOW=0; shift ;;
    -h | --help)
      grep '^#' "$0" | head -8
      exit 0
      ;;
    api | ui | postgres) TARGETS+=("$1"); shift ;;
    *)
      echo "error: unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

if ((${#TARGETS[@]} == 0)); then
  TARGETS=(api ui)
fi

spendflow_load_dev_env

LOG_FILES=()
HAS_POSTGRES=0

for target in "${TARGETS[@]}"; do
  case "${target}" in
    api | ui)
      log_file="$(spendflow_dev_log_file "${target}")"
      if [[ ! -f "${log_file}" ]]; then
        echo "warn: no log file yet: ${log_file} (run ./scripts/podman/dev.sh)" >&2
        continue
      fi
      LOG_FILES+=("${log_file}")
      ;;
    postgres)
      HAS_POSTGRES=1
      ;;
    *)
      echo "error: unknown target: ${target}" >&2
      exit 1
      ;;
  esac
done

if ((${#LOG_FILES[@]} > 0)); then
  if [[ "${FOLLOW}" -eq 1 ]]; then
    tail -n 40 -f "${LOG_FILES[@]}"
  else
    for log_file in "${LOG_FILES[@]}"; do
      echo "=== ${log_file} ==="
      tail -n 80 "${log_file}"
      echo ""
    done
  fi
fi

if [[ "${HAS_POSTGRES}" -eq 1 ]]; then
  spendflow_require_cmd podman
  spendflow_ensure_podman
  export SPENDFLOW_COMPOSE_PROFILE=bundled-db
  if [[ "${FOLLOW}" -eq 1 ]]; then
    spendflow_compose logs -f postgres
  else
    spendflow_compose logs --tail 80 postgres
  fi
fi
