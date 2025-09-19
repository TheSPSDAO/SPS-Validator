#!/bin/bash

cat <<EOT >> /var/lib/postgresql/data/postgresql.conf
shared_preload_libraries='pg_partman_bgw'
pg_partman_bgw.dbname = '$VALIDATOR_DB'

shared_buffers=${POSTGRES_SHARED_BUFFERS:-512MB}
maintenance_work_mem=${POSTGRES_MAINTENANCE_WORK_MEM:-128MB}
work_mem=${POSTGRES_WORK_MEM:-16MB}
autovacuum=${POSTGRES_AUTOVACUUM:-on}
max_wal_size=${POSTGRES_MAX_WAL_SIZE:-1GB}
synchronous_commit=${POSTGRES_SYNCHRONOUS_COMMIT:-on}
fsync=${POSTGRES_FSYNC:-on}

EOT
