-- Revert splinterlands-validator:token_transfer_keys from pg

BEGIN;

DROP TABLE IF EXISTS :APP_SCHEMA.token_transfer_keys;

COMMIT;
