-- Deploy splinterlands-validator:validators to pg
-- requires: appschema
BEGIN;

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.validators (
    account_name character varying (20) NOT NULL,
    reward_account character varying (20) DEFAULT NULL,
    is_active boolean NOT NULL,
    post_url character varying(1024) COLLATE pg_catalog."default",
    total_votes numeric(12, 3) NOT NULL DEFAULT 0,
    missed_blocks int NOT NULL DEFAULT 0,
    CONSTRAINT validators_pkey PRIMARY KEY (account_name)
);

CREATE INDEX IF NOT EXISTS validators_total_votes_idx ON :APP_SCHEMA.validators USING btree (total_votes DESC);
CREATE INDEX IF NOT EXISTS validators_reward_account ON :APP_SCHEMA.validators USING btree (reward_account);
CREATE INDEX IF NOT EXISTS validators_active ON :APP_SCHEMA.validators USING btree (is_active);

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.validator_votes (
    voter character varying (20) NOT NULL,
    validator character varying (20) NOT NULL,
    vote_weight numeric(12, 3) NOT NULL,
    CONSTRAINT validator_votes_pkey PRIMARY KEY (voter, validator)
);

CREATE INDEX IF NOT EXISTS validator_votes_validator_idx ON :APP_SCHEMA.validator_votes USING btree (validator);

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.validator_vote_history (
    transaction_id character varying (100) NOT NULL,
    created_date timestamp without time zone NOT NULL,
    voter character varying (20) NOT NULL,
    validator character varying (20) NOT NULL,
    is_approval boolean NOT NULL,
    vote_weight numeric(12, 3) NOT NULL,
    CONSTRAINT validator_vote_history_pkey PRIMARY KEY (transaction_id)
);

GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.validators TO :APP_USER;

GRANT SELECT, INSERT , UPDATE ON TABLE :APP_SCHEMA.validator_votes TO :APP_USER;

GRANT SELECT , INSERT , UPDATE ON TABLE :APP_SCHEMA.validator_vote_history TO :APP_USER;

ALTER TABLE
    :APP_SCHEMA.blocks
ADD
    COLUMN IF NOT EXISTS validation_tx character varying (100);

COMMIT;
