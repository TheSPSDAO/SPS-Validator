-- Deploy splinterlands-validator:snapshot-tables-unlogged to pg

BEGIN;

ALTER TABLE snapshot.token_unstaking SET UNLOGGED;
ALTER TABLE snapshot.hive_accounts SET UNLOGGED;
ALTER TABLE snapshot.balances SET UNLOGGED;
ALTER TABLE snapshot.balance_history SET UNLOGGED;
ALTER TABLE snapshot.staking_pool_reward_debt SET UNLOGGED;
ALTER TABLE snapshot.validator_votes SET UNLOGGED;
ALTER TABLE snapshot.validators SET UNLOGGED;
ALTER TABLE snapshot.validator_vote_history SET UNLOGGED;
ALTER TABLE snapshot.blocks SET UNLOGGED;
ALTER TABLE snapshot.validator_transactions SET UNLOGGED;
ALTER TABLE snapshot.validator_transaction_players SET UNLOGGED;
ALTER TABLE snapshot.price_history SET UNLOGGED;
ALTER TABLE snapshot.active_delegations SET UNLOGGED;
ALTER TABLE snapshot.validator_check_in SET UNLOGGED;
ALTER TABLE snapshot.promise SET UNLOGGED;
ALTER TABLE snapshot.promise_history SET UNLOGGED;
ALTER TABLE snapshot.config SET UNLOGGED;

COMMIT;
