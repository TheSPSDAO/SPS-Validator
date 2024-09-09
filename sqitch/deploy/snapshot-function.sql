-- Deploy splinterlands-validator:snapshot-function to pg
-- requires: snapshot-tables

BEGIN;
CREATE OR REPLACE FUNCTION snapshot.freshSnapshot()
    RETURNS VOID AS
$$
BEGIN
    -- can't use replacements here (:APP_SCHEMA) because we're in a function. this function _has_ to run as the APP_USER
    
    -- Delete any pre-existing snapshot data
    TRUNCATE snapshot.token_unstaking;
    TRUNCATE snapshot.hive_accounts;
    TRUNCATE snapshot.balances;
    TRUNCATE snapshot.staking_pool_reward_debt;
    TRUNCATE snapshot.validator_votes;
    TRUNCATE snapshot.validators;
    TRUNCATE snapshot.validator_vote_history;
    TRUNCATE snapshot.blocks;
    TRUNCATE snapshot.price_history;

    INSERT INTO snapshot.token_unstaking (player, unstake_tx, unstake_start_date, is_active, token, total_qty,
                                          next_unstake_date, total_unstaked, unstaking_periods,
                                          unstaking_interval_seconds, cancel_tx)
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
    WHERE is_active = true;

    INSERT INTO snapshot.hive_accounts (name) SELECT name FROM hive_accounts;

    INSERT INTO snapshot.balances (player, token, balance) SELECT player, token, balance FROM balances;

    INSERT INTO snapshot.staking_pool_reward_debt (player, pool_name, reward_debt)
    SELECT player, pool_name, reward_debt
    FROM staking_pool_reward_debt;

    INSERT INTO snapshot.validator_votes (voter, validator, vote_weight)
    SELECT voter, validator, vote_weight
    FROM validator_votes;

    INSERT INTO snapshot.validators (account_name, is_active, post_url, total_votes, missed_blocks)
    SELECT account_name, is_active, post_url, total_votes, missed_blocks
    FROM validators;

    INSERT INTO snapshot.validator_vote_history (transaction_id, created_date, voter, validator, is_approval,
                                                 vote_weight)
    SELECT transaction_id, created_date, voter, validator, is_approval, vote_weight
    FROM validator_vote_history;

    INSERT INTO snapshot.blocks (block_num, block_id, prev_block_id, l2_block_id, block_time, validator)
    SELECT block_num, block_id, prev_block_id, l2_block_id, block_time, validator
    FROM blocks
    ORDER BY block_num DESC
    LIMIT 100;

    INSERT INTO snapshot.price_history (validator, token, block_num, block_time, token_price)
    SELECT validator, token, block_num, block_time, token_price
    FROM price_history;

END;
$$ language 'plpgsql';
COMMIT;
