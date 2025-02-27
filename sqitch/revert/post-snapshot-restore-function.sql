-- Revert splinterlands-validator:post-snapshot-restore-function from pg

BEGIN;

DROP FUNCTION IF EXISTS snapshot.post_snapshot_restore(text);

COMMIT;
