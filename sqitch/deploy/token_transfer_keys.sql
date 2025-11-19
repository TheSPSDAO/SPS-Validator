-- Deploy splinterlands-validator:token_transfer_keys to pg
BEGIN;

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.token_transfer_keys (
    account character varying (20) NOT NULL,
    key character varying (64) NOT NULL,
    trx_id TEXT NOT NULL,
    block_num integer NOT NULL,
    block_time timestamp without time zone NOT NULL,
    PRIMARY KEY (account, key)
);

COMMIT;
