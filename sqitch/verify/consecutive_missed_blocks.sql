-- Verify splinterlands-validator:consecutive_missed_blocks on pg
BEGIN;

SELECT
    consecutive_missed_blocks
FROM
    :APP_SCHEMA.validators
WHERE
    TRUE = FALSE;

ROLLBACK;
