#!/usr/bin/env bash
# Start SpendFlow containers (build + podman compose up).
# Alias for deploy.sh — there is no separate runtime beyond compose.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "${SCRIPT_DIR}/deploy.sh" "$@"
