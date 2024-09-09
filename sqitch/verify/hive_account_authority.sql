-- Verify splinterlands-validator:hive_account_authority on pg

BEGIN;

SELECT
    name,
    authority
FROM
    :APP_SCHEMA.hive_accounts
WHERE
    1 = 0;

ROLLBACK;
