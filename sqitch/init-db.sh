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

# Create the database if it does not exist
psql -Atx "${CONNECTION_STRING}" -c "SELECT 1 FROM pg_database WHERE datname = '${APP_DATABASE}'" |
	grep -q 1 ||
	psql -v "ON_ERROR_STOP=1" -Atx "${CONNECTION_STRING}" -c "CREATE DATABASE ${APP_DATABASE} WITH OWNER ${APP_USER}"
