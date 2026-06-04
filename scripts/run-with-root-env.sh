#!/usr/bin/env bash
# Run a package script with repo-root .env loaded.
# Usage: ./scripts/run-with-root-env.sh backend dev
#        ./scripts/run-with-root-env.sh backend db:seed -- --no-reset
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PKG="${1:?package directory (backend|ui)}"
SCRIPT="${2:-dev}"
shift 2

if [[ -f "${ROOT}/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "${ROOT}/.env"
  set +a
fi

case "${PKG}" in
  backend)
    export PORT="${PORT:-4000}"
    ;;
  ui)
    export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:4000/api/v1}"
    export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3002}"
    export NEXT_PUBLIC_USE_MOCKS="${NEXT_PUBLIC_USE_MOCKS:-false}"
    export NEXT_PUBLIC_GOOGLE_CLIENT_ID="${NEXT_PUBLIC_GOOGLE_CLIENT_ID:-${GOOGLE_CLIENT_ID:-}}"
    ;;
  *)
    echo "error: unknown package '${PKG}'" >&2
    exit 1
    ;;
esac

cd "${ROOT}/${PKG}"
if [[ $# -gt 0 ]]; then
  exec npm run "${SCRIPT}" -- "$@"
else
  exec npm run "${SCRIPT}"
fi
