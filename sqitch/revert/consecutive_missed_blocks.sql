-- Revert splinterlands-validator:consecutive_missed_blocks from pg
BEGIN;

ALTER TABLE
    :APP_SCHEMA.validators DROP COLUMN IF EXISTS consecutive_missed_blocks;

COMMIT;
