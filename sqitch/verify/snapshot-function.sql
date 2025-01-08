-- Verify splinterlands-validator:snapshot-function on pg

BEGIN;

SELECT has_function_privilege('snapshot.freshsnapshot(boolean, text)', 'execute');

ROLLBACK;
