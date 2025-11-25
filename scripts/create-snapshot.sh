#!/usr/bin/env bash

POSTGRES_HOST=${POSTGRES_HOST:-localhost}
POSTGRES_USER=${POSTGRES_USER:-postgres}
POSTGRES_DB=${POSTGRES_DB:-postgres}

# ask for the password if PGPASSWORD is not set
if [ -z "$PGPASSWORD" ]; then
  read -s -r -p "Password for $POSTGRES_USER@$POSTGRES_HOST/$POSTGRES_DB: " PGPASSWORD
fi

# Run the snapshot.freshsnapshot function first
echo "Running snapshot.freshsnapshot() function to prepare the snapshot..."
PGPASSWORD=$PGPASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT snapshot.freshsnapshot();"
echo "Snapshot function executed successfully."

echo "Creating snapshot.sql file..."
PGPASSWORD=$PGPASSWORD pg_dump --no-owner --no-acl \
  --no-comments --no-publications --no-security-labels \
  --schema snapshot -T snapshot.snapshot_history -T snapshot.state \
  -T snapshot.validator_transactions_backup -T snapshot.validator_transaction_players_backup \
  -T snapshot.blocks_backup -T snapshot.balances_backup \
  --no-subscriptions --no-tablespaces --data-only \
  --host "${POSTGRES_HOST}" \
  --username "${POSTGRES_USER}" \
  "${POSTGRES_DB}" > snapshot.sql
echo "Snapshot.sql file created successfully."

# get the latest change from the sqitch.changes table with psql
echo "Getting the latest change from the sqitch.changes table..."
CHANGE=$(PGPASSWORD=$PGPASSWORD psql -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -c "SELECT change FROM sqitch.changes WHERE project = 'splinterlands-validator' ORDER BY committed_at DESC LIMIT 1")
# trim whitespace from the change
CHANGE=$(echo "$CHANGE" | xargs echo -n)
echo "Latest change: $CHANGE"
# add to the beginning of the snapshot.sql file like -- to_change:$CHANGE
sed -i "1s/^/-- to_change:$CHANGE\n/" snapshot.sql

echo "Snapshot created. You can find it in snapshot.sql"

read -p "Would you like to zip the snapshot? (y/n)" -n 1 -r
echo    # (optional) move to a new line

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Zipping snapshot"
    zip snapshot.zip snapshot.sql
    echo "Snapshot zipped. You can find it in snapshot.zip"

    read -p "Would you like to remove the snapshot.sql file? (y/n)" -n 1 -r
    echo    # (optional) move to a new line

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm snapshot.sql
    fi
fi

# get first line from the snapshot.sql file
