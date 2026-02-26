-- Revert rental_delegations table from pg

BEGIN;

DROP TABLE IF EXISTS :APP_SCHEMA.rental_delegations;

COMMIT;
