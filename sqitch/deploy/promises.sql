-- Deploy splinterlands-validator:promises to pg

BEGIN;

CREATE TYPE :APP_SCHEMA.promise_status AS ENUM (
    'open',
    'fulfilled',
    'completed',
    'cancelled'
);

CREATE TABLE :APP_SCHEMA.promise (
    id SERIAL PRIMARY KEY,
    ext_id TEXT NOT NULL,
    -- "delegation"
    type TEXT NOT NULL,
    status :APP_SCHEMA.promise_status NOT NULL,
    -- { amount: 1000, token: "SPSP" }
    params JSONB NOT NULL,
    -- accounts that can complete or cancel the promise
    controllers TEXT[] NOT NULL,
    -- if someone fulfills the promise, it will automatically be cancelled if it is not completed within this interval
    fulfill_timeout_seconds INT,
    -- who fulfilled the promise
    fulfilled_by TEXT,
    -- this would be in the history table so do we need it?
    fulfilled_at TIMESTAMP WITHOUT TIME ZONE,
    fulfilled_expiration TIMESTAMP WITHOUT TIME ZONE,
    created_date TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    updated_date TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE INDEX promise_type_ext_id_idx ON :APP_SCHEMA.promise (type, ext_id);

CREATE TABLE :APP_SCHEMA.promise_history (
    id SERIAL PRIMARY KEY,
    promise_id INT NOT NULL,
    action TEXT NOT NULL,
    player TEXT NOT NULL,
    previous_status :APP_SCHEMA.promise_status,
    new_status :APP_SCHEMA.promise_status NOT NULL,
    trx_id TEXT NOT NULL,
    created_date TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

CREATE INDEX promise_history_promise_id_idx ON :APP_SCHEMA.promise_history (promise_id);

COMMIT;
