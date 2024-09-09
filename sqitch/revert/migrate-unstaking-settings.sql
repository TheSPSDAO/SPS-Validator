-- Revert splinterlands-validator:migrate-unstaking-settings from pg

BEGIN;

DELETE FROM :APP_SCHEMA.config
WHERE group_name = 'sps' AND name IN ('unstaking_interval_seconds', 'unstaking_periods');

COMMIT;
