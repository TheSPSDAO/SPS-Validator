#!/usr/bin/env bash

# our version of pg_dump doesnt support excluding extensions,
# so we have to exclude the extensions manually
# just remove any lines that start with CREATE EXTENSION
# from the dump file
pg_dump --schema-only --no-owner --no-acl --disable-triggers \
  --no-comments --no-publications --no-security-labels \
  -N snapshot -N sqitch -N sqitch-data -N partman \
  -T '*_temp' -T 'blocks_p*' -T 'validator_transactions_p*' \
  -T 'validator_transaction_players_p*' -T '*_template' \
  --no-subscriptions --no-tablespaces \
  --host "${POSTGRES_HOST:-localhost}" \
  --username "${POSTGRES_USER:-postgres}" \
  "${POSTGRES_DB:-postgres}" | \
  # remove the CREATE EXTENSION lines
  sed '/^CREATE EXTENSION/d' | \
  # remove the \restrict abcdef and \unrestrict lines. postgres is adding this maybe?
  sed '/^\\restrict/d; /^\\unrestrict/d'

