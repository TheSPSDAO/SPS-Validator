-- Revert splinterlands-validator:snapshot from pg

BEGIN;


TRUNCATE TABLE snapshot.balances;
TRUNCATE TABLE snapshot.balance_history;
TRUNCATE TABLE snapshot.hive_accounts;
TRUNCATE TABLE snapshot.staking_pool_reward_debt;
TRUNCATE TABLE snapshot.validator_votes;
TRUNCATE TABLE snapshot.validator_vote_history;
TRUNCATE TABLE snapshot.validators;
TRUNCATE TABLE snapshot.blocks;
TRUNCATE TABLE snapshot.token_unstaking;
TRUNCATE TABLE snapshot.price_history;
TRUNCATE TABLE snapshot.config;
TRUNCATE TABLE snapshot.active_delegations;
TRUNCATE TABLE snapshot.validator_check_in;
TRUNCATE TABLE snapshot.promise;
TRUNCATE TABLE snapshot.promise_history;

TRUNCATE TABLE :APP_SCHEMA.balances;
TRUNCATE TABLE :APP_SCHEMA.balance_history;
TRUNCATE TABLE :APP_SCHEMA.hive_accounts;
TRUNCATE TABLE :APP_SCHEMA.staking_pool_reward_debt;
TRUNCATE TABLE :APP_SCHEMA.validator_votes;
TRUNCATE TABLE :APP_SCHEMA.validator_vote_history;
TRUNCATE TABLE :APP_SCHEMA.validators;
TRUNCATE TABLE :APP_SCHEMA.blocks;
TRUNCATE TABLE :APP_SCHEMA.token_unstaking;
TRUNCATE TABLE :APP_SCHEMA.price_history;
TRUNCATE TABLE :APP_SCHEMA.config;
TRUNCATE TABLE :APP_SCHEMA.active_delegations;
TRUNCATE TABLE :APP_SCHEMA.validator_check_in;
TRUNCATE TABLE :APP_SCHEMA.promise;
TRUNCATE TABLE :APP_SCHEMA.promise_history;

COMMIT;
