-- Revert splinterlands-validator:snapshot from pg

BEGIN;

-- XXX Add DDLs here.
TRUNCATE :APP_SCHEMA.hive_accounts;
TRUNCATE :APP_SCHEMA.blocks;
TRUNCATE :APP_SCHEMA.validator_transactions;
TRUNCATE :APP_SCHEMA.validator_transaction_players;
TRUNCATE :APP_SCHEMA.token_unstaking;
TRUNCATE :APP_SCHEMA.staking_pool_reward_debt;
TRUNCATE :APP_SCHEMA.config;
TRUNCATE :APP_SCHEMA.balances;
TRUNCATE :APP_SCHEMA.balance_history;

COMMIT;
