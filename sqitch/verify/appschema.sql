-- Verify splinterlands-validator:appschema on pg

BEGIN;

DO
$$
    BEGIN
        ASSERT (SELECT has_schema_privilege('public', 'usage'));
    END
$$;

SELECT player,
       token,
       amount,
       balance_start,
       balance_end,
       block_num,
       trx_id,
       type,
       created_date,
       counterparty
FROM balance_history
WHERE FALSE;

SELECT player, token, balance
FROM balances
WHERE FALSE;

SELECT group_name, group_type, name, index, value_type, last_updated_date, last_updated_tx
FROM config
WHERE FALSE;

SELECT player, pool_name, reward_debt
FROM staking_pool_reward_debt
WHERE FALSE;

SELECT player,
       unstake_tx,
       unstake_start_date,
       is_active,
       token,
       total_qty,
       next_unstake_date,
       total_unstaked,
       unstaking_periods,
       unstaking_interval_seconds,
       cancel_tx
FROM token_unstaking
WHERE FALSE;

SELECT transaction_id, player
FROM validator_transaction_players
WHERE FALSE;

SELECT id,
       block_id,
       prev_block_id,
       type,
       player,
       data,
       success,
       error,
       block_num,
       index,
       created_date,
       result
FROM validator_transactions
WHERE FALSE;

SELECT block_num, block_id, prev_block_id, l2_block_id, block_time, validator
FROM blocks
WHERE FALSE;

SELECT name
FROM hive_accounts
WHERE FALSE;

ROLLBACK;
