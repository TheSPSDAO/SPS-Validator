#!/bin/bash

cat <<EOT >> /var/lib/postgresql/data/postgresql.conf
shared_preload_libraries='pg_partman_bgw'
pg_partman_bgw.dbname = '$VALIDATOR_DB'
EOT
