-- Revert splinterlands-validator:running-validator-reward-pool from pg

BEGIN;

DELETE FROM :APP_SCHEMA.config WHERE group_name = 'sps' AND name LIKE 'validator_rewards%';
DELETE FROM :APP_SCHEMA.config WHERE group_name = 'validator_check_in';
DROP TABLE :APP_SCHEMA.validator_check_in;
DROP TYPE :APP_SCHEMA.validator_check_in_status;

COMMIT;
