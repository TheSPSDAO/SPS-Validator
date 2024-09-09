-- Deploy splinterlands-validator:starting-block to pg
-- requires: snapshot

BEGIN;

INSERT INTO :APP_SCHEMA.blocks (block_num, block_id, prev_block_id, l2_block_id, block_time, validator, validation_tx)
SELECT :last_block, 'seed-block-id', 'previous-seed-block-id', 'seed-block-l2-id', '2022-01-20 14:55:53.32528', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM :APP_SCHEMA.blocks);

COMMIT;
