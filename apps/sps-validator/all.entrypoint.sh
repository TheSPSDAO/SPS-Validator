#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

APP_USER=${APP_USER:-$PGUSER}
APP_SCHEMA=${APP_SCHEMA:-public}

pushd sqitch
"./init-db.sh"
PGUSER=$APP_USER PGPASSWORD=$APP_PASSWORD PGDATABASE=$APP_DATABASE sqitch deploy --set "APP_USER=${APP_USER}" --set "APP_SCHEMA=${APP_SCHEMA}"
popd

/usr/bin/dumb-init -- node "./dist/main.js"
