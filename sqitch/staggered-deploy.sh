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

# check if SNAPSHOT is a directory then use the new restore method
if [ -d "$SNAPSHOT" ]
then
    # new restore method
    # the change is in the snapshot directories .change file so get that
    to_change=$(cat "$SNAPSHOT/.change")
    echo "Deploying changes up to $to_change"

    # Make sure to_change is actually in the sqitch.plan (a new snapshot on an old version)
    # skip any lines that start with % or blank lines, look at the first column
    # and check if it matches the to_change
    if ! grep --max-count=1 --only-matching --perl-regexp "^$to_change\s" "$SCRIPT_DIR/sqitch.plan" > /dev/null; then
        echo "Error: $to_change not found in sqitch.plan"
        exit 1
    fi

    pushd "$SCRIPT_DIR" > /dev/null
    PGUSER=$APP_USER PGPASSWORD=$APP_PASSWORD PGDATABASE=$APP_DATABASE sqitch deploy --to-change "$to_change"@HEAD --set APP_USER="$APP_USER" --set "APP_SCHEMA=$APP_SCHEMA" --set "DB_BLOCK_RETENTION=$DB_BLOCK_RETENTION" --verbose |& grep --invert-match "$silent_expected_error" || echo "Initial part of the migration was already run, skipping..."

    # this is where the new behavior changes. we need to manually call the pre/post functions and use pg_restore
    # this is a hack for rebuilding from an older snapshot

    # check if we have a row in sqitch.project table for snapshot. we're hacking the sqitch schema here but faster restores are worth it
    SNAPSHOT_EXISTS=$(PGUSER=$APP_USER PGPASSWORD=$APP_PASSWORD PGDATABASE=$APP_DATABASE psql -Atx -c "SELECT 1 FROM sqitch.projects WHERE project = 'splinterlands-validator-snapshot';" || echo "0")

    if [ "$SNAPSHOT_EXISTS" != "1" ]; then
        echo "Restoring snapshot from $SNAPSHOT"

        echo "Clearing out snapshot tables for restore..."
        PGPASSWORD="$APP_PASSWORD" psql -U "$APP_USER" -d "$APP_DATABASE" -c "SELECT snapshot.pre_snapshot_restore();" || true

        echo "Setting snapshot tables to unlogged for faster restore..."
        # Before we restore, we switch all of the tables in the snapshot schema to unlogged (sqitch also does this, but we may be restoring an older snapshot on a new version)
        PGPASSWORD="$APP_PASSWORD" psql -U "$APP_USER" -d "$APP_DATABASE" -c "
            DO \$\$
            DECLARE
                table_name TEXT;
            BEGIN
                FOR table_name IN
                    SELECT schemaname||'.'||tablename
                    FROM pg_tables
                    WHERE schemaname = 'snapshot'
                LOOP
                    EXECUTE 'ALTER TABLE ' || table_name || ' SET UNLOGGED';
                END LOOP;
            END \$\$;
        "

        echo "Restoring snapshot using pg_restore..."
        POSTGRES_RESTORE_JOBS=${POSTGRES_RESTORE_JOBS:-2}
        PGPASSWORD="$APP_PASSWORD" pg_restore -U "$APP_USER" -d "$APP_DATABASE" --jobs "$POSTGRES_RESTORE_JOBS" "$SNAPSHOT"

        echo "Restoring validator data from snapshot..."
        PGPASSWORD="$APP_PASSWORD" psql -U "$APP_USER" -d "$APP_DATABASE" -c "SELECT snapshot.post_snapshot_restore();" || true

        # insert a row into sqitch.project to mark that we've restored the snapshot
        PGPASSWORD="$APP_PASSWORD" psql -U "$APP_USER" -d "$APP_DATABASE" -c "INSERT INTO sqitch.projects (project, uri, created_at, creator_name, creator_email) VALUES ('splinterlands-validator-snapshot', 'restored from $SNAPSHOT', NOW(), '$APP_USER', '$APP_USER');"
    else
        echo "Snapshot already restored, skipping pg_restore"
    fi

    echo "Deploying any remaining changes after snapshot..."
    PGUSER=$APP_USER PGPASSWORD=$APP_PASSWORD PGDATABASE=$APP_DATABASE sqitch deploy --set APP_USER="$APP_USER" --set "APP_SCHEMA=$APP_SCHEMA" --set "DB_BLOCK_RETENTION=$DB_BLOCK_RETENTION" --verbose
else
    # old restore method
    # get the change this snapshot was created with
    to_change=$(grep --max-count=1 --only-matching --perl-regexp '^-- to_change:(\S+)$' "$SNAPSHOT" | cut --delimiter=: --fields=2 || true)
    # if the snapshot was created without a change, use the pre-snapshot change
    if [ -z "$to_change" ]; then
    to_change='pre-snapshot'
    fi
    echo "Deploying changes up to $to_change"

    # Make sure to_change is actually in the sqitch.plan (a new snapshot on an old version)
    # skip any lines that start with % or blank lines, look at the first column
    # and check if it matches the to_change
    if ! grep --max-count=1 --only-matching --perl-regexp "^$to_change\s" "$SCRIPT_DIR/sqitch.plan" > /dev/null; then
        echo "Error: $to_change not found in sqitch.plan"
        exit 1
    fi

    pushd "$SCRIPT_DIR" > /dev/null
    PGUSER=$APP_USER PGPASSWORD=$APP_PASSWORD PGDATABASE=$APP_DATABASE sqitch deploy --to-change "$to_change"@HEAD --set APP_USER="$APP_USER" --set "APP_SCHEMA=$APP_SCHEMA" --set "DB_BLOCK_RETENTION=$DB_BLOCK_RETENTION" --verbose |& grep --invert-match "$silent_expected_error" || echo "Initial part of the migration was already run, skipping..."
    PGUSER=$APP_USER PGPASSWORD=$APP_PASSWORD PGDATABASE=$APP_DATABASE sqitch deploy -t sqitch-data --set snapshot_file="$SNAPSHOT" --set APP_USER="$APP_USER" --set "APP_SCHEMA=$APP_SCHEMA" --verbose | { grep --invert-match "$silent_expected_logspam" || true; }
    PGUSER=$APP_USER PGPASSWORD=$APP_PASSWORD PGDATABASE=$APP_DATABASE sqitch deploy --set APP_USER="$APP_USER" --set "APP_SCHEMA=$APP_SCHEMA" --set "DB_BLOCK_RETENTION=$DB_BLOCK_RETENTION" --verbose

fi

echo "Snapshot and migrations complete."
