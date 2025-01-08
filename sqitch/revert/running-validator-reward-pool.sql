-- Revert splinterlands-validator:running-validator-reward-pool from pg

BEGIN;

DROP TABLE :APP_SCHEMA.validator_check_in;
DROP TYPE :APP_SCHEMA.validator_check_in_status;

COMMIT;
