-- Verify splinterlands-validator:transaction_players_perf on pg

BEGIN;

SELECT
    transaction_id,
    player,
    block_num
FROM
    :APP_SCHEMA.transaction_players
WHERE FALSE;

ROLLBACK;
