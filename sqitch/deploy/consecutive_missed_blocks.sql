-- Deploy splinterlands-validator:consecutive_missed_blocks to pg
BEGIN;

ALTER TABLE
    :APP_SCHEMA.validators
ADD
    COLUMN IF NOT EXISTS consecutive_missed_blocks INTEGER NOT NULL DEFAULT 0;

COMMIT;
