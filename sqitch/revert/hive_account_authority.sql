-- Revert splinterlands-validator:hive_account_authority from pg

BEGIN;

ALTER TABLE :APP_SCHEMA.hive_accounts DROP COLUMN IF EXISTS authority;

COMMIT;
