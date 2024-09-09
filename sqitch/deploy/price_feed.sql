-- Deploy splinterlands-validator:price_feed to pg
-- requires: validators

BEGIN;
SET client_min_messages = warning;

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.price_history
(
    validator     character varying(50) COLLATE pg_catalog."default" NOT NULL,
    token         character varying(20)                              NOT NULL,
    block_num     integer                                            NOT NULL,
    block_time    timestamp without time zone                        NOT NULL,
    token_price   numeric(12, 6)                                     NOT NULL
);

ALTER TABLE ONLY :APP_SCHEMA.price_history
    ADD CONSTRAINT price_history_pkey PRIMARY KEY (validator, token);

GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.price_history TO :APP_USER;

COMMIT;
