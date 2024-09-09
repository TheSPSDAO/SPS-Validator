-- Verify splinterlands-validator:promises on pg

BEGIN;

SELECT
    id,
    ext_id,
    type,
    status,
    params,
    controllers,
    fulfill_timeout_seconds,
    fulfilled_by,
    fulfilled_at,
    fulfilled_expiration,
    created_date,
    updated_date
FROM
    :APP_SCHEMA.promise
WHERE FALSE;

SELECT
    id,
    promise_id,
    action,
    player,
    previous_status,
    new_status,
    trx_id,
    created_date
FROM
    :APP_SCHEMA.promise_history
WHERE FALSE;

ROLLBACK;
