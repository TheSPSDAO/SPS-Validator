-- Revert splinterlands-validator:validators from pg

BEGIN;

DELETE FROM :APP_SCHEMA.config WHERE group_name = 'validator' AND name = 'reduction_pct';
DELETE FROM :APP_SCHEMA.config WHERE group_name = 'validator' AND name = 'reduction_blocks';
DELETE FROM :APP_SCHEMA.config WHERE group_name = 'validator' AND name = 'tokens_per_block';
DELETE FROM :APP_SCHEMA.config WHERE group_name = 'validator' AND name = 'reward_start_block';
DELETE FROM :APP_SCHEMA.config WHERE group_name = 'validator' AND name = 'min_validators';
DELETE FROM :APP_SCHEMA.config WHERE group_name = 'validator' AND name = 'max_block_age';
DELETE FROM :APP_SCHEMA.config WHERE group_name = 'validator' AND name = 'max_votes';

DROP TABLE IF EXISTS :APP_SCHEMA.validator_vote_history;
DROP TABLE IF EXISTS :APP_SCHEMA.validator_votes;
DROP TABLE IF EXISTS :APP_SCHEMA.validators;

COMMIT;
