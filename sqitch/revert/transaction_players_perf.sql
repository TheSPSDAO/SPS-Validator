-- Revert splinterlands-validator:transaction_players_perf from pg

BEGIN;

ALTER TABLE :APP_SCHEMA.transaction_players DROP COLUMN IF EXISTS block_num;

COMMIT;
