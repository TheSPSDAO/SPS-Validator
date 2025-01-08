-- Verify splinterlands-validator:running-validator-reward-pool on pg

BEGIN;

SELECT
    account,
    status,
    last_check_in_block_num,
    last_check_in
FROM
    :APP_SCHEMA.validator_check_in
WHERE
    FALSE;

ROLLBACK;
