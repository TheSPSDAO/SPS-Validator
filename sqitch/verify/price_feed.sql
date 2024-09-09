-- Verify splinterlands-validator:price_feed on pg

BEGIN;

INSERT INTO :APP_SCHEMA.price_history
VALUES ('$VALIDATOR', 'SPS', -7331, now(), 10);

ROLLBACK;
