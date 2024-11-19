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
    TRUNCATE snapshot.balance_history;
    TRUNCATE snapshot.staking_pool_reward_debt;
    TRUNCATE snapshot.validator_votes;
    TRUNCATE snapshot.validators;
    TRUNCATE snapshot.validator_vote_history;
    TRUNCATE snapshot.blocks;
    TRUNCATE snapshot.validator_transactions;
    TRUNCATE snapshot.validator_transaction_players;
    TRUNCATE snapshot.price_history;
    TRUNCATE snapshot.active_delegations;
    TRUNCATE snapshot.validator_check_in;
    TRUNCATE snapshot.promise;
    TRUNCATE snapshot.promise_history;

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

    INSERT INTO snapshot.hive_accounts (name, authority) SELECT name, authority FROM hive_accounts;

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
    ORDER BY block_num DESC; -- TODO: add "archive" flag to copy all or only the last 100 blocks

    -- todo add "archive" flag that determines if we copy these
    INSERT INTO snapshot.validator_transactions (
        id,
        block_id,
        prev_block_id,
        type,
        player,
        data,
        success,
        error,
        block_num,
        created_date,
        result
    )
    SELECT
        id,
        block_id,
        prev_block_id,
        type,
        player,
        data,
        success,
        error,
        block_num,
        created_date,
        result
    FROM
        validator_transactions;

    -- todo add "archive" flag that determines if we copy these
    INSERT INTO snapshot.validator_transaction_players (transaction_id, player)
    SELECT transaction_id, player
    FROM validator_transaction_players;

    INSERT INTO snapshot.price_history (validator, token, block_num, block_time, token_price)
    SELECT validator, token, block_num, block_time, token_price
    FROM price_history;

    INSERT INTO snapshot.active_delegations (delegator, delegatee, amount, token, created_date)
    SELECT delegator, delegatee, amount, token, created_date
    FROM active_delegations;

    INSERT INTO snapshot.validator_check_in (validator, block_num, block_time)
    SELECT validator, block_num, block_time
    FROM validator_check_in;

    INSERT INTO snapshot.promise (id, ext_id, type, status, params, controllers, fulfill_timeout_seconds, fulfilled_by, fulfilled_at, fulfilled_expiration, created_date, updated_date)
    SELECT
        id,
        ext_id,
        type,
        status,
        params,
        controllers,
        fulfill_timeout_seconds, fulfilled_by,
        fulfilled_at,
        fulfilled_expiration,
        created_date,
        updated_date
    FROM
        promise; -- TODO: add "archive" flag that determines if we copy all or only "open" promises

    -- TODO: add "archive" flag that determines if we copy this
    INSERT INTO snapshot.balance_history (player, token, amount, balance_start, balance_end, block_num, trx_id, type, created_date, counterparty)
    SELECT
        player,
        token,
        amount,
        balance_start,
        balance_end,
        block_num,
        trx_id,
        type,
        created_date,
        counterparty
    FROM
        balance_history;

    -- TODO: add "archive" flag that determines if we copy this
    INSERT INTO snapshot.promise_history (id, promise_id, action, player, previous_status, new_status, trx_id, created_date)
    SELECT
        id,
        promise_id,
        action,
        player,
        previous_status,
        new_status,
        trx_id,
        created_date
    FROM
        promise_history;

END;
$$ language 'plpgsql';

COMMIT;
