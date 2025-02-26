-- Revert splinterlands-validator:transaction_players_perf from pg

BEGIN;

ALTER TABLE :APP_SCHEMA.validator_transaction_players DROP COLUMN IF EXISTS block_num;
ALTER TABLE :APP_SCHEMA.validator_transaction_players DROP COLUMN IF EXISTS is_owner;
ALTER TABLE :APP_SCHEMA.validator_transaction_players DROP COLUMN IF EXISTS success;
ALTER TABLE :APP_SCHEMA.validator_transaction_players DROP COLUMN IF EXISTS type;

DROP TABLE snapshot.validator_transaction_players;
CREATE TABLE snapshot.validator_transaction_players AS TABLE :APP_SCHEMA.validator_transaction_players WITH NO DATA;

COMMIT;
