-- Verify splinterlands-validator:reward_delegations on pg

BEGIN;

SELECT
    player,
    delegate_to_player,
    type,
    token,
    percent,
    trx_id,
    delegation_date
FROM
    :APP_SCHEMA.reward_delegations
WHERE
    FALSE;

SELECT
    player,
    delegate_to_player,
    type,
    token,
    percent,
    trx_id,
    delegation_date
FROM
    :APP_SCHEMA.reward_delegation_history
WHERE
    FALSE;


ROLLBACK;
