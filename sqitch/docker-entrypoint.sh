#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
TMP_TEMPLATE="${TMPDIR:-/tmp/}$(basename "$0").XXXXXXXXXXXX"
env_file=$(mktemp "$TMP_TEMPLATE")

"$SCRIPT_DIR/extract-snapshot.sh" "$SNAPSHOT_ZIP" "$env_file"
"$SCRIPT_DIR/init-db.sh"
# ShellCheck can't follow non-constant source. Use a directive to specify location.
# shellcheck disable=SC1090
source "$env_file"
"$SCRIPT_DIR/staggered-deploy.sh"
rm -f "$env_file"
