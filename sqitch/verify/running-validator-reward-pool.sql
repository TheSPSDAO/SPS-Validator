-- Verify splinterlands-validator:running-validator-reward-pool on pg

BEGIN;

SELECT * FROM :APP_SCHEMA.config WHERE group_name = 'sps' AND name LIKE 'validator_rewards%';

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
