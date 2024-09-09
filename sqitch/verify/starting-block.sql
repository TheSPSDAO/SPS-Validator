-- Verify splinterlands-validator:starting-block on pg

BEGIN;

SELECT EXISTS(SELECT 1 FROM :APP_SCHEMA.blocks);

ROLLBACK;
