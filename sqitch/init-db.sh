#!/usr/bin/env bash

set -eo pipefail

CONNECTION_STRING="postgres://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/postgres"

APP_USER=${APP_USER:-$PGUSER}
APP_PASSWORD=${APP_PASSWORD:-$PGPASSWORD}
APP_DATABASE=${APP_DATABASE:-$PGDATABASE}

# Create the users if it does not exist
psql -Atx "${CONNECTION_STRING}" -c "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = '${APP_USER}'" |
	grep -q 1 ||
	psql -v "ON_ERROR_STOP=1" -Atx "${CONNECTION_STRING}" -c "CREATE ROLE ${APP_USER} WITH LOGIN PASSWORD '${APP_PASSWORD}'" -c "GRANT ${APP_USER} TO ${PGUSER}"

# grant the user permission to create on the database if it exists
psql -Atx "${CONNECTION_STRING}" -c "SELECT 1 FROM pg_database WHERE datname = '${APP_DATABASE}'" |
	grep -q 1 && psql -v "ON_ERROR_STOP=1" -Atx "${CONNECTION_STRING}" -c "GRANT CREATE ON DATABASE ${APP_DATABASE} TO ${APP_USER};"

# or, create the database if it does not exist
psql -Atx "${CONNECTION_STRING}" -c "SELECT 1 FROM pg_database WHERE datname = '${APP_DATABASE}'" |
	grep -q 1 ||
	psql -v "ON_ERROR_STOP=1" -Atx "${CONNECTION_STRING}" -c "CREATE DATABASE ${APP_DATABASE} WITH OWNER ${APP_USER}"

# if the sqitch schema already exists, grant permissions to the app user
psql -Atx "${CONNECTION_STRING}" -c "SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'sqitch'" |
	grep -q 1 && psql -v "ON_ERROR_STOP=1" -Atx "${CONNECTION_STRING}" -c "GRANT ALL ON ALL TABLES IN SCHEMA sqitch TO ${APP_USER}" || true

# if the snapshot schema already exists and the owner is not the app user then drop it
psql -Atx "${CONNECTION_STRING}" -c "SELECT 1 FROM pg_catalog.pg_namespace JOIN pg_catalog.pg_roles ON pg_catalog.pg_roles.oid = pg_catalog.pg_namespace.nspowner WHERE pg_catalog.pg_namespace.nspname = 'snapshot' AND rolname != '${APP_USER}'" |
	grep -q 1 && psql -v "ON_ERROR_STOP=1" -Atx "${CONNECTION_STRING}" -c "DROP SCHEMA snapshot CASCADE;" || true
