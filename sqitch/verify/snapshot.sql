-- Verify splinterlands-validator:snapshot on pg

BEGIN;

SELECT EXISTS(
       SELECT 1 FROM :APP_SCHEMA.config
       WHERE group_name='$root'
       AND   group_type='object'
       AND   name='admin_accounts');

ROLLBACK;
