-- Verify splinterlands-validator:snapshot-function on pg

BEGIN;

SELECT has_function_privilege('snapshot.freshSnapshot()', 'execute');

ROLLBACK;
