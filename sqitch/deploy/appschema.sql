-- Deploy splinterlands-validator:appschema to pg

BEGIN;

SET client_min_messages = warning;

CREATE SCHEMA IF NOT EXISTS :APP_SCHEMA;
GRANT CREATE ON SCHEMA :APP_SCHEMA TO :APP_USER;
GRANT USAGE ON SCHEMA :APP_SCHEMA TO :APP_USER;
ALTER ROLE :APP_USER SET search_path TO :APP_SCHEMA;

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.balance_history
(
    player        character varying(50)       NOT NULL,
    token         character varying(20)       NOT NULL,
    amount        numeric(14, 3)              NOT NULL,
    balance_start numeric(15, 3)              NOT NULL,
    balance_end   numeric(15, 3)              NOT NULL,
    block_num     integer                     NOT NULL,
    trx_id        character varying(100)      NOT NULL,
    type          character varying(50)       NOT NULL,
    created_date  timestamp without time zone NOT NULL,
    counterparty  character varying(50)
);

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.balances
(
    player  character varying(50)    NOT NULL,
    token   character varying(20)    NOT NULL,
    balance numeric(15, 3) DEFAULT 0 NOT NULL,
    CONSTRAINT balances_pkey PRIMARY KEY (player, token)
)
WITH (
    FILLFACTOR = 80
);

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.config
(
    group_name        character varying(50)                                     NOT NULL,
    group_type        character varying(20) DEFAULT 'object'::character varying NOT NULL,
    name              character varying(50)                                     NOT NULL,
    index             smallint              DEFAULT 0                           NOT NULL,
    value_type        character varying(20) DEFAULT 'string'::character varying NOT NULL,
    value             text,
    last_updated_date timestamp without time zone,
    last_updated_tx   character varying(100),
    CONSTRAINT config_pkey PRIMARY KEY (group_name, name)
);

CREATE SEQUENCE IF NOT EXISTS :APP_SCHEMA.item_details_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.staking_pool_reward_debt
(
    player      character varying(50)    NOT NULL,
    pool_name   character varying(50)    NOT NULL,
    reward_debt numeric(15, 3) DEFAULT 0 NOT NULL,
    CONSTRAINT staking_pool_reward_debt_pkey PRIMARY KEY (player, pool_name)
);

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.token_unstaking
(
    player                     character varying(50)       NOT NULL,
    unstake_tx                 character varying(100)      NOT NULL,
    unstake_start_date         timestamp without time zone NOT NULL,
    is_active                  boolean                     NOT NULL,
    token                      character varying(20)       NOT NULL,
    total_qty                  numeric(15, 3)              NOT NULL,
    next_unstake_date          timestamp without time zone NOT NULL,
    total_unstaked             numeric(15, 3) DEFAULT 0    NOT NULL,
    unstaking_periods          smallint                    NOT NULL,
    unstaking_interval_seconds integer                     NOT NULL,
    cancel_tx                  character varying(100),
    CONSTRAINT token_unstaking_pkey PRIMARY KEY (unstake_tx)
);

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.validator_transaction_players
(
    transaction_id character varying(100) NOT NULL,
    player         character varying(50)  NOT NULL,
    CONSTRAINT validator_transaction_players_pkey PRIMARY KEY (transaction_id, player)
);

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.validator_transactions
(
    id            character varying(1024) NOT NULL,
    block_id      character varying(1024) NOT NULL,
    prev_block_id character varying(1024) NOT NULL,
    type          character varying(100)  NOT NULL,
    player        character varying(50)   NOT NULL,
    data          text,
    success       boolean,
    error         text,
    block_num     integer,
    created_date  timestamp without time zone,
    result        text,
    CONSTRAINT validator_transactions_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_balance_history_created_date ON :APP_SCHEMA.balance_history USING btree (created_date DESC);
CREATE INDEX IF NOT EXISTS idx_balance_history_player ON :APP_SCHEMA.balance_history USING btree (player);
CREATE INDEX IF NOT EXISTS validator_transaction_players_player_idx ON :APP_SCHEMA.validator_transaction_players USING btree (player);
CREATE INDEX IF NOT EXISTS validator_transactions_block_num_idx ON :APP_SCHEMA.validator_transactions USING btree (block_num);
CREATE INDEX IF NOT EXISTS validator_transactions_created_date_idx ON :APP_SCHEMA.validator_transactions USING btree (created_date);
CREATE INDEX IF NOT EXISTS validator_transactions_type_player_idx ON :APP_SCHEMA.validator_transactions USING btree (player, type);

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.blocks
(
    block_num     integer                                              NOT NULL,
    block_id      character varying(1024) COLLATE pg_catalog."default" NOT NULL,
    prev_block_id character varying(1024) COLLATE pg_catalog."default" NOT NULL,
    l2_block_id   character varying(1024) COLLATE pg_catalog."default" NOT NULL,
    block_time    timestamp without time zone                          NOT NULL,
    validator     character varying(50) COLLATE pg_catalog."default",
    CONSTRAINT blocks_pkey PRIMARY KEY (block_num)
);

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.hive_accounts
(
    name character varying(20) NOT NULL,
    CONSTRAINT hive_accounts_pkey PRIMARY KEY (name)
);

GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.balance_history TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.balances TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.config TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.staking_pool_reward_debt TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.token_unstaking TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.validator_transaction_players TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.validator_transactions TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.blocks TO :APP_USER;
GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.hive_accounts TO :APP_USER;

COMMIT;
