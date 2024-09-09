-- Revert splinterlands-validator:active_delegations from pg

BEGIN;

DROP TABLE IF EXISTS :APP_SCHEMA.active_delegations;

COMMIT;
