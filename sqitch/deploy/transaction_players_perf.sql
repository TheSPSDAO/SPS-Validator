-- Deploy splinterlands-validator:transaction_players_perf to pg

BEGIN;

ALTER TABLE :APP_SCHEMA.transaction_players ADD COLUMN IF NOT EXISTS block_num integer;

CREATE INDEX IF NOT EXISTS validator_transaction_players_block_num_idx ON :APP_SCHEMA.transaction_players USING btree (block_num);

-- migrate existing data
UPDATE :APP_SCHEMA.transaction_players
SET block_num = t.block_num
FROM :APP_SCHEMA.validator_transactions t
WHERE transaction_players.transaction_id = t.id;

ALTER TABLE :APP_SCHEMA.transaction_players ALTER COLUMN block_num SET NOT NULL;

COMMIT;
