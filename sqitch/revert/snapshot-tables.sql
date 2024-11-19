-- Revert splinterlands-validator:snapshot-tables from pg

BEGIN;

DROP TABLE IF EXISTS snapshot.validator_vote_history;
DROP TABLE IF EXISTS snapshot.validator_votes;
DROP TABLE IF EXISTS snapshot.validators;
DROP TABLE IF EXISTS snapshot.hive_accounts;
DROP TABLE IF EXISTS snapshot.blocks;
DROP TABLE IF EXISTS snapshot.validator_transactions;
DROP TABLE IF EXISTS snapshot.validator_transaction_players;
DROP TABLE IF EXISTS snapshot.token_unstaking;
DROP TABLE IF EXISTS snapshot.staking_pool_reward_debt;
DROP TABLE IF EXISTS snapshot.balances;
DROP TABLE IF EXISTS snapshot.balance_history;
DROP TABLE IF EXISTS snapshot.price_history;
DROP TABLE IF EXISTS snapshot.config;
DROP TABLE IF EXISTS snapshot.active_delegations;
DROP TABLE IF EXISTS snapshot.validator_check_in;
DROP TABLE IF EXISTS snapshot.promise;
DROP TABLE IF EXISTS snapshot.promise_history;

DROP SCHEMA IF EXISTS snapshot;

COMMIT;
