-- Deploy splinterlands-validator:snapshot-tables to pg
-- requires: appschema
-- requires: validators

BEGIN;
CREATE SCHEMA snapshot;
CREATE TABLE snapshot.balances AS TABLE :APP_SCHEMA.balances WITH NO DATA;
CREATE TABLE snapshot.hive_accounts AS TABLE :APP_SCHEMA.hive_accounts WITH NO DATA;
CREATE TABLE snapshot.staking_pool_reward_debt AS TABLE :APP_SCHEMA.staking_pool_reward_debt WITH NO DATA;
CREATE TABLE snapshot.validator_votes AS TABLE :APP_SCHEMA.validator_votes WITH NO DATA;
CREATE TABLE snapshot.validator_vote_history AS TABLE :APP_SCHEMA.validator_vote_history WITH NO DATA;
CREATE TABLE snapshot.validators AS TABLE :APP_SCHEMA.validators WITH NO DATA;
CREATE TABLE snapshot.blocks AS TABLE :APP_SCHEMA.blocks WITH NO DATA;
CREATE TABLE snapshot.token_unstaking AS TABLE :APP_SCHEMA.token_unstaking WITH NO DATA;
CREATE TABLE snapshot.price_history AS TABLE :APP_SCHEMA.price_history WITH NO DATA;
COMMIT;
