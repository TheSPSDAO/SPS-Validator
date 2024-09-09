-- Deploy splinterlands-validator:hive_account_authority to pg

BEGIN;

ALTER TABLE :APP_SCHEMA.hive_accounts ADD COLUMN IF NOT EXISTS authority JSONB NOT NULL DEFAULT '{}';

COMMIT;
