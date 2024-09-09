-- Revert splinterlands-validator:appschema from pg

BEGIN;

DROP TABLE IF EXISTS :APP_SCHEMA.hive_accounts;
DROP TABLE IF EXISTS :APP_SCHEMA.blocks;
DROP TABLE IF EXISTS :APP_SCHEMA.validator_transactions;
DROP TABLE IF EXISTS :APP_SCHEMA.validator_transaction_players;
DROP TABLE IF EXISTS :APP_SCHEMA.token_unstaking;
DROP TABLE IF EXISTS :APP_SCHEMA.staking_pool_reward_debt;
DROP SEQUENCE IF EXISTS :APP_SCHEMA.item_details_id_seq;
DROP TABLE IF EXISTS :APP_SCHEMA.config;
DROP TABLE IF EXISTS :APP_SCHEMA.balances;
DROP TABLE IF EXISTS :APP_SCHEMA.balance_history;
DROP SCHEMA IF EXISTS :APP_SCHEMA;

COMMIT;
