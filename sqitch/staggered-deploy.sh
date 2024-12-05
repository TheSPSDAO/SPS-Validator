#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
SCRIPT_NAME=$0

function usage {
    echo "usage: $SCRIPT_NAME [-h]"
    echo "  -h      display help"
    echo "  Required environment variables:"
    echo "    - SNAPSHOT"
    echo "  Configuration environment variables:"
    echo "    - PGUSER"
    echo "    - PGHOST"
    echo "    - PGDATABASE"
    echo "    - PGPORT"
    echo "    - PGPASSWORD"
}

while getopts ":h" option; do
   case $option in
      h) # Display usage instructions
         usage
         exit;;
      *) # Unsupported flag
         usage
         exit 1;;
   esac
done

if [ -z ${SNAPSHOT+x} ]
then
  echo "SNAPSHOT is unset."
  usage
  exit 1
fi

silent_expected_error='Cannot deploy to an earlier change; use "revert" instead'
silent_expected_logspam='Nothing to deploy (up-to-date)'

pushd "$SCRIPT_DIR" > /dev/null
PGUSER=$APP_USER PGPASSWORD=$APP_PASSWORD PGDATABASE=$APP_DATABASE sqitch deploy --to-change pre-snapshot@HEAD --set APP_USER="$APP_USER" --set "APP_SCHEMA=$APP_SCHEMA" --verbose |& grep --invert-match "$silent_expected_error" || echo "Initial part of the migration was already run, skipping..."
PGUSER=$APP_USER PGPASSWORD=$APP_PASSWORD PGDATABASE=$APP_DATABASE sqitch deploy -t sqitch-data --set snapshot_file="$SNAPSHOT" --set APP_USER="$APP_USER" --set "APP_SCHEMA=$APP_SCHEMA" --verbose | { grep --invert-match "$silent_expected_logspam" || true; }
PGUSER=$APP_USER PGPASSWORD=$APP_PASSWORD PGDATABASE=$APP_DATABASE sqitch deploy --set APP_USER="$APP_USER" --set "APP_SCHEMA=$APP_SCHEMA" --verbose
