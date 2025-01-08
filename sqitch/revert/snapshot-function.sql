-- Revert splinterlands-validator:snapshot-function from pg

BEGIN;

DROP FUNCTION snapshot.freshsnapshot(boolean, text);

COMMIT;
