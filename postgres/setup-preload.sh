#!/bin/bash

cat <<EOT >> /var/lib/postgresql/data/postgresql.conf
shared_preload_libraries='pg_cron,pg_partman_bgw'
cron.database_name='$VALIDATOR_DB'
pg_partman_bgw.dbname = '$VALIDATOR_DB'
EOT
