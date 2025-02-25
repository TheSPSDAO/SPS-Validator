-- Deploy splinterlands-validator:transaction_players_perf to pg

BEGIN;

ALTER TABLE :APP_SCHEMA.validator_transaction_players ADD COLUMN IF NOT EXISTS block_num integer;
ALTER TABLE :APP_SCHEMA.validator_transaction_players ADD COLUMN IF NOT EXISTS is_owner boolean;
ALTER TABLE :APP_SCHEMA.validator_transaction_players ADD COLUMN IF NOT EXISTS success boolean;
ALTER TABLE :APP_SCHEMA.validator_transaction_players ADD COLUMN IF NOT EXISTS type character varying(100);

CREATE INDEX IF NOT EXISTS validator_transaction_players_player_block_type_idx ON :APP_SCHEMA.validator_transaction_players USING btree (player ASC, block_num ASC, type ASC);
CREATE INDEX IF NOT EXISTS validator_transaction_players_block_type_idx ON :APP_SCHEMA.validator_transaction_players USING btree (block_num ASC, type ASC) WHERE success AND is_owner IS TRUE;

-- migrate existing data
UPDATE :APP_SCHEMA.validator_transaction_players
SET block_num = t.block_num, is_owner = t.player = validator_transaction_players.player, success = t.success, type = t.type
FROM :APP_SCHEMA.validator_transactions t
WHERE validator_transaction_players.transaction_id = t.id;

ALTER TABLE :APP_SCHEMA.validator_transaction_players ALTER COLUMN block_num SET NOT NULL;
ALTER TABLE :APP_SCHEMA.validator_transaction_players ALTER COLUMN is_owner SET NOT NULL;
ALTER TABLE :APP_SCHEMA.validator_transaction_players ALTER COLUMN type SET NOT NULL;

COMMIT;
