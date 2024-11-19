-- Verify splinterlands-validator:snapshot-tables on pg
BEGIN;

SELECT
    player,
    token,
    balance
FROM
    snapshot.balances
WHERE
    FALSE;

SELECT
    name
FROM
    snapshot.hive_accounts
WHERE
    FALSE;

SELECT
    player,
    pool_name,
    reward_debt
FROM
    snapshot.staking_pool_reward_debt
WHERE
    FALSE;

SELECT
    voter,
    validator,
    vote_weight
FROM
    snapshot.validator_votes
WHERE
    FALSE;

SELECT
    transaction_id,
    created_date,
    voter,
    validator,
    is_approval,
    vote_weight
FROM
    snapshot.validator_vote_history
WHERE
    FALSE;

SELECT
    account_name,
    is_active,
    post_url,
    total_votes,
    missed_blocks
FROM
    snapshot.validators
WHERE
    FALSE;

SELECT
    block_num,
    block_id,
    prev_block_id,
    l2_block_id,
    block_time,
    validator
FROM
    snapshot.blocks
WHERE
    FALSE;

SELECT
    player,
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
FROM
    snapshot.token_unstaking
WHERE
    FALSE;

SELECT
    validator,
    token,
    block_num,
    block_time,
    token_price
FROM
    snapshot.price_history
WHERE
    FALSE;

SELECT
    group_name,
    group_type,
    name,
    index,
    value_type,
    last_updated_date,
    last_updated_tx
FROM
    snapshot.config
WHERE
    FALSE;

SELECT
    token,
    delegator,
    delegatee,
    amount,
    last_delegation_tx,
    last_delegation_date,
    last_undelegation_date,
    last_undelegation_tx
FROM
    snapshot.active_delegations
WHERE
    FALSE;

SELECT
    account,
    status,
    last_check_in_block_num,
    last_check_in
FROM
    snapshot.validator_check_in
WHERE
    FALSE;

SELECT
    id,
    ext_id,
    type,
    status,
    params,
    controllers,
    fulfill_timeout_seconds,
    fulfilled_by,
    fulfilled_at,
    fulfilled_expiration,
    created_date,
    updated_date
FROM
    snapshot.promise
WHERE FALSE;

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
    snapshot.promise_history
WHERE FALSE;

ROLLBACK;
