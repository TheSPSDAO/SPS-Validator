-- Revert splinterlands-validator:snapshot-function from pg

BEGIN;

DROP FUNCTION snapshot.freshSnapshot();

COMMIT;
