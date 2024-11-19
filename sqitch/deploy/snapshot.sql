-- Deploy splinterlands-validator:snapshot to pg
-- requires: validators
-- requires: appschema

BEGIN;

TRUNCATE TABLE snapshot.balances;
TRUNCATE TABLE snapshot.balance_history;
TRUNCATE TABLE snapshot.hive_accounts;
TRUNCATE TABLE snapshot.staking_pool_reward_debt;
TRUNCATE TABLE snapshot.validator_votes;
TRUNCATE TABLE snapshot.validator_vote_history;
TRUNCATE TABLE snapshot.validators;
TRUNCATE TABLE snapshot.blocks;
TRUNCATE TABLE snapshot.validator_transactions;
TRUNCATE TABLE snapshot.validator_transaction_players;
TRUNCATE TABLE snapshot.token_unstaking;
TRUNCATE TABLE snapshot.price_history;
TRUNCATE TABLE snapshot.config;
TRUNCATE TABLE snapshot.active_delegations;
TRUNCATE TABLE snapshot.validator_check_in;
TRUNCATE TABLE snapshot.promise;
TRUNCATE TABLE snapshot.promise_history;

\i :snapshot_file

INSERT INTO :APP_SCHEMA.active_delegations SELECT * FROM snapshot.active_delegations;
INSERT INTO :APP_SCHEMA.balance_history SELECT * FROM snapshot.balance_history;
INSERT INTO :APP_SCHEMA.balances SELECT * FROM snapshot.balances;
INSERT INTO :APP_SCHEMA.config SELECT * FROM snapshot.config;
INSERT INTO :APP_SCHEMA.hive_accounts SELECT * FROM snapshot.hive_accounts;
INSERT INTO :APP_SCHEMA.price_history SELECT * FROM snapshot.price_history;
INSERT INTO :APP_SCHEMA.staking_pool_reward_debt SELECT * FROM snapshot.staking_pool_reward_debt;
INSERT INTO :APP_SCHEMA.validator_votes SELECT * FROM snapshot.validator_votes;
INSERT INTO :APP_SCHEMA.validator_vote_history SELECT * FROM snapshot.validator_vote_history;
INSERT INTO :APP_SCHEMA.validators SELECT * FROM snapshot.validators;
INSERT INTO :APP_SCHEMA.blocks SELECT * FROM snapshot.blocks;
INSERT INTO :APP_SCHEMA.validator_transactions SELECT * FROM snapshot.validator_transactions;
INSERT INTO :APP_SCHEMA.validator_transaction_players SELECT * FROM snapshot.validator_transaction_players;
INSERT INTO :APP_SCHEMA.token_unstaking SELECT * FROM snapshot.token_unstaking;
INSERT INTO :APP_SCHEMA.validator_check_in SELECT * FROM snapshot.validator_check_in;

-- special handling for serial keyed tables
INSERT INTO :APP_SCHEMA.promise SELECT * FROM snapshot.promise;
INSERT INTO :APP_SCHEMA.promise_history SELECT * FROM snapshot.promise_history;
-- set the sequence values for the serial columns
SELECT setval(:'APP_SCHEMA' || '.promise_id_seq', (SELECT MAX(id) FROM :APP_SCHEMA.promise), true);
SELECT setval(:'APP_SCHEMA' || '.promise_history_id_seq', (SELECT MAX(id) FROM :APP_SCHEMA.promise_history), true);

TRUNCATE TABLE snapshot.balances;
TRUNCATE TABLE snapshot.balance_history;
TRUNCATE TABLE snapshot.hive_accounts;
TRUNCATE TABLE snapshot.staking_pool_reward_debt;
TRUNCATE TABLE snapshot.validator_votes;
TRUNCATE TABLE snapshot.validator_vote_history;
TRUNCATE TABLE snapshot.validators;
TRUNCATE TABLE snapshot.blocks;
TRUNCATE TABLE snapshot.validator_transactions;
TRUNCATE TABLE snapshot.validator_transaction_players;
TRUNCATE TABLE snapshot.token_unstaking;
TRUNCATE TABLE snapshot.price_history;
TRUNCATE TABLE snapshot.config;
TRUNCATE TABLE snapshot.active_delegations;
TRUNCATE TABLE snapshot.validator_check_in;
TRUNCATE TABLE snapshot.promise;
TRUNCATE TABLE snapshot.promise_history;

COMMIT;
