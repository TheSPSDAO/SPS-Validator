-- Revert splinterlands-validator:snapshot-tables-unlogged from pg

BEGIN;

ALTER TABLE snapshot.token_unstaking SET LOGGED;
ALTER TABLE snapshot.hive_accounts SET LOGGED;
ALTER TABLE snapshot.balances SET LOGGED;
ALTER TABLE snapshot.balance_history SET LOGGED;
ALTER TABLE snapshot.staking_pool_reward_debt SET LOGGED;
ALTER TABLE snapshot.validator_votes SET LOGGED;
ALTER TABLE snapshot.validators SET LOGGED;
ALTER TABLE snapshot.validator_vote_history SET LOGGED;
ALTER TABLE snapshot.blocks SET LOGGED;
ALTER TABLE snapshot.validator_transactions SET LOGGED;
ALTER TABLE snapshot.validator_transaction_players SET LOGGED;
ALTER TABLE snapshot.price_history SET LOGGED;
ALTER TABLE snapshot.active_delegations SET LOGGED;
ALTER TABLE snapshot.validator_check_in SET LOGGED;
ALTER TABLE snapshot.promise SET LOGGED;
ALTER TABLE snapshot.promise_history SET LOGGED;
ALTER TABLE snapshot.config SET LOGGED;

COMMIT;
