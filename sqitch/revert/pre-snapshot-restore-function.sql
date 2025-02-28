-- Revert splinterlands-validator:pre-snapshot-function from pg

BEGIN;

DROP FUNCTION IF EXISTS snapshot.pre_snapshot_restore(text);

COMMIT;
