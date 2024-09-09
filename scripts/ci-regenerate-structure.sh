#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
ROOT_DIR="${SCRIPT_DIR}/.."
SQITCH_DIR="${ROOT_DIR}/sqitch"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"
VALIDATOR_DIR="${ROOT_DIR}"
PGPASSWORD=${POSTGRES_PASSWORD:-postgres}
DOCKER_COMPOSE_NETWORK_DEFAULT=validator:postgres
DOCKER_COMPOSE_NETWORK=${DOCKER_COMPOSE_NETWORK:-$DOCKER_COMPOSE_NETWORK_DEFAULT}

warn_customized_network() {
  if [[ "x$DOCKER_COMPOSE_NETWORK" != "x$DOCKER_COMPOSE_NETWORK_DEFAULT" ]]
  then
      >&2 echo "DOCKER_COMPOSE_NETWORK was manually tweaked. Consider following the documented procedures in README.md instead of this CI-specific script, as using this script prevents you from properly running a validator node without starting over with a fresh database."
  fi
}

ensure_db() {
  docker compose -f "${COMPOSE_FILE}" up --build -d pg
}

ensure_migrations() {
  echo "About to run migrations, which can take several minutes..."
  sleep 1

  docker run --rm --network "$DOCKER_COMPOSE_NETWORK" \
    -e PGUSER="${POSTGRES_USER:-postgres}" \
    -e PGDATABASE="${POSTGRES_DB:-postgres}" \
    -e PGPASSWORD="${PGPASSWORD}" \
    -e PGHOST="pg" \
    -e PGPORT="5432" \
    --mount "type=bind,src=${SQITCH_DIR},dst=/repo" \
    sqitch/sqitch deploy --set "APP_USER=${POSTGRES_USER:-postgres}" --set "APP_SCHEMA=${POSTGRES_SCHEMA:-public}"
}

dump_structure() {
    PGPASSWORD="${PGPASSWORD}" npm run --prefix "${VALIDATOR_DIR}" dump-structure
}

warn_customized_network
ensure_db
ensure_migrations
dump_structure
