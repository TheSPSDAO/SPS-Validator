-- Verify splinterlands-validator:transaction_players_perf on pg

BEGIN;

SELECT
    transaction_id,
    player,
    block_num,
    is_owner,
    success,
    type
FROM
    :APP_SCHEMA.validator_transaction_players
WHERE FALSE;

ROLLBACK;
