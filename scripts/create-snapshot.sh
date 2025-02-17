#!/usr/bin/env bash
pg_dump --no-owner --no-acl \
  --no-comments --no-publications --no-security-labels \
  --schema snapshot -T snapshot.snapshot_history -T snapshot.state \
  --no-subscriptions --no-tablespaces --data-only \
  --host "${POSTGRES_HOST:-localhost}" \
  --username "${POSTGRES_USER:-postgres}" \
  "${POSTGRES_DB:-postgres}" > snapshot.sql

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
