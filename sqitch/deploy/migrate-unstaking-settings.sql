-- Deploy splinterlands-validator:migrate-unstaking-settings to pg

BEGIN;

INSERT INTO :APP_SCHEMA.config
    (group_name, group_type, name, index, value_type, value, last_updated_date)
VALUES
    ('sps', 'object', 'unstaking_interval_seconds', 0, 'number', '604800', '2024-08-30 13:37:00.000000'),
    ('sps', 'object', 'unstaking_periods', 0, 'number', '4', '2024-08-30 13:37:00.000000');

COMMIT;
