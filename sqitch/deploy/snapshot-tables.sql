-- Deploy splinterlands-validator:snapshot-tables to pg
-- requires: appschema
-- requires: validators

BEGIN;
CREATE SCHEMA snapshot;
CREATE TABLE snapshot.balances AS TABLE :APP_SCHEMA.balances WITH NO DATA;
CREATE TABLE snapshot.balance_history AS TABLE :APP_SCHEMA.balance_history WITH NO DATA;
CREATE TABLE snapshot.hive_accounts AS TABLE :APP_SCHEMA.hive_accounts WITH NO DATA;
CREATE TABLE snapshot.staking_pool_reward_debt AS TABLE :APP_SCHEMA.staking_pool_reward_debt WITH NO DATA;
CREATE TABLE snapshot.validator_votes AS TABLE :APP_SCHEMA.validator_votes WITH NO DATA;
CREATE TABLE snapshot.validator_vote_history AS TABLE :APP_SCHEMA.validator_vote_history WITH NO DATA;
CREATE TABLE snapshot.validators AS TABLE :APP_SCHEMA.validators WITH NO DATA;
CREATE TABLE snapshot.blocks AS TABLE :APP_SCHEMA.blocks WITH NO DATA;
CREATE TABLE snapshot.validator_transactions AS TABLE :APP_SCHEMA.validator_transactions WITH NO DATA;
CREATE TABLE snapshot.validator_transaction_players AS TABLE :APP_SCHEMA.validator_transaction_players WITH NO DATA;
CREATE TABLE snapshot.token_unstaking AS TABLE :APP_SCHEMA.token_unstaking WITH NO DATA;
CREATE TABLE snapshot.price_history AS TABLE :APP_SCHEMA.price_history WITH NO DATA;
CREATE TABLE snapshot.config AS TABLE :APP_SCHEMA.config WITH NO DATA;
CREATE TABLE snapshot.active_delegations AS TABLE :APP_SCHEMA.active_delegations WITH NO DATA;
CREATE TABLE snapshot.validator_check_in AS TABLE :APP_SCHEMA.validator_check_in WITH NO DATA;
CREATE TABlE snapshot.promise AS TABLE :APP_SCHEMA.promise WITH NO DATA;
CREATE TABLE snapshot.promise_history AS TABLE :APP_SCHEMA.promise_history WITH NO DATA;

GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.balances TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.balance_history TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.hive_accounts TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.staking_pool_reward_debt TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.validator_votes TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.validator_vote_history TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.validators TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.blocks TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.validator_transactions TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.validator_transaction_players TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.token_unstaking TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.price_history TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.config TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.active_delegations TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.validator_check_in TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.promise TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE snapshot.promise_history TO :APP_USER;

COMMIT;
