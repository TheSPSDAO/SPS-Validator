-- Verify splinterlands-validator:token_transfer_keys on pg
BEGIN;

SELECT
    account,
    key,
    trx_id,
    block_num,
    block_time
FROM
    :APP_SCHEMA.token_transfer_keys
WHERE
    TRUE = FALSE;

ROLLBACK;
