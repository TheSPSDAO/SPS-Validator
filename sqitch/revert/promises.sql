-- Revert splinterlands-validator:promises from pg

BEGIN;

DROP TABLE :APP_SCHEMA.promise_history;
DROP TABLE :APP_SCHEMA.promise;
DROP TYPE :APP_SCHEMA.promise_status;

COMMIT;
