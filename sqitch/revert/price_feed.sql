-- Revert splinterlands-validator:price_feed from pg

BEGIN;

DROP TABLE IF EXISTS :APP_SCHEMA.price_history;

COMMIT;
