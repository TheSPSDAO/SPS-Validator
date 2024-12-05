-- Deploy splinterlands-validator:snapshot-tables to pg
-- requires: appschema
-- requires: validators

BEGIN;

CREATE SCHEMA IF NOT EXISTS snapshot;
CREATE TABLE IF NOT EXISTS snapshot.balances AS TABLE :APP_SCHEMA.balances WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.balance_history AS TABLE :APP_SCHEMA.balance_history WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.hive_accounts AS TABLE :APP_SCHEMA.hive_accounts WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.staking_pool_reward_debt AS TABLE :APP_SCHEMA.staking_pool_reward_debt WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.validator_votes AS TABLE :APP_SCHEMA.validator_votes WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.validator_vote_history AS TABLE :APP_SCHEMA.validator_vote_history WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.validators AS TABLE :APP_SCHEMA.validators WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.blocks AS TABLE :APP_SCHEMA.blocks WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.validator_transactions AS TABLE :APP_SCHEMA.validator_transactions WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.validator_transaction_players AS TABLE :APP_SCHEMA.validator_transaction_players WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.token_unstaking AS TABLE :APP_SCHEMA.token_unstaking WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.price_history AS TABLE :APP_SCHEMA.price_history WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.config AS TABLE :APP_SCHEMA.config WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.active_delegations AS TABLE :APP_SCHEMA.active_delegations WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.validator_check_in AS TABLE :APP_SCHEMA.validator_check_in WITH NO DATA;
CREATE TABlE IF NOT EXISTS snapshot.promise AS TABLE :APP_SCHEMA.promise WITH NO DATA;
CREATE TABLE IF NOT EXISTS snapshot.promise_history AS TABLE :APP_SCHEMA.promise_history WITH NO DATA;

GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.balances TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.balance_history TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.hive_accounts TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.staking_pool_reward_debt TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.validator_votes TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.validator_vote_history TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.validators TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.blocks TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.validator_transactions TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.validator_transaction_players TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.token_unstaking TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.price_history TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.config TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.active_delegations TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.validator_check_in TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.promise TO :APP_USER;
GRANT SELECT, INSERT, UPDATE, TRUNCATE ON TABLE snapshot.promise_history TO :APP_USER;

COMMIT;
