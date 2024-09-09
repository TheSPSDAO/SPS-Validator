#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT_DIR="${SCRIPT_DIR}/.."
SQITCH_DIR="${ROOT_DIR}/sqitch"
VALIDATOR_DIR="${ROOT_DIR}/apps/sps-validator/src/__tests__"

MOST_RECENT_MIGRATION=$(find "${SQITCH_DIR}" -type f -printf "%T+\t%p\n" | sort | tail -1 | cut -f2)
TARGET="${VALIDATOR_DIR}/structure.sql"
echo "$TARGET: $MOST_RECENT_MIGRATION;${SCRIPT_DIR}/ci-regenerate-structure.sh" | make -f- && exit 0

