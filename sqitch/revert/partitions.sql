-- Revert splinterlands-validator:partitions from pg

BEGIN;

-- drop the blocks table
DROP TABLE :APP_SCHEMA.blocks;

-- create the blocks table with partitions
CREATE TABLE :APP_SCHEMA.blocks
(
    block_num     integer                                              NOT NULL,
    block_id      character varying(1024) COLLATE pg_catalog."default" NOT NULL,
    prev_block_id character varying(1024) COLLATE pg_catalog."default" NOT NULL,
    l2_block_id   character varying(1024) COLLATE pg_catalog."default" NOT NULL,
    block_time    timestamp without time zone                          NOT NULL,
    validator     character varying(50) COLLATE pg_catalog."default",
    validation_tx character varying (100),
    CONSTRAINT blocks_pkey PRIMARY KEY (block_num)
);

INSERT INTO :APP_SCHEMA.blocks
SELECT * FROM :APP_SCHEMA.blocks_temp;

CREATE INDEX IF NOT EXISTS blocks_validator_idx ON :APP_SCHEMA.blocks USING btree (validator);

DROP TABLE :APP_SCHEMA.blocks_temp;

CREATE TABLE :APP_SCHEMA.validator_transactions
(
    id            character varying(1024) NOT NULL,
    block_id      character varying(1024) NOT NULL,
    prev_block_id character varying(1024) NOT NULL,
    type          character varying(100)  NOT NULL,
    player        character varying(50)   NOT NULL,
    data          text compression lz4,
    success       boolean,
    error         text,
    block_num     integer,
    index         smallint                NOT NULL,
    created_date  timestamp without time zone,
    result        text compression lz4,
    CONSTRAINT validator_transactions_pkey PRIMARY KEY (id)
);

INSERT INTO :APP_SCHEMA.validator_transactions
SELECT * FROM :APP_SCHEMA.validator_transactions_temp;

CREATE INDEX IF NOT EXISTS validator_transactions_block_num_idx ON :APP_SCHEMA.validator_transactions USING btree (block_num, index ASC);
CREATE INDEX IF NOT EXISTS validator_transactions_created_date_idx ON :APP_SCHEMA.validator_transactions USING btree (created_date);
CREATE INDEX IF NOT EXISTS validator_transactions_type_player_idx ON :APP_SCHEMA.validator_transactions USING btree (player, type);

DROP TABLE :APP_SCHEMA.validator_transactions_temp;

CREATE TABLE :APP_SCHEMA.validator_transaction_players
(
    transaction_id character varying(100) NOT NULL,
    player         character varying(50)  NOT NULL,
    block_num      integer NOT NULL,
    is_owner       boolean NOT NULL,
    success        boolean,
    type           character varying(100) NOT NULL,
    CONSTRAINT validator_transaction_players_pkey PRIMARY KEY (transaction_id, player)
);

INSERT INTO :APP_SCHEMA.validator_transaction_players
SELECT * FROM :APP_SCHEMA.validator_transaction_players_temp;

CREATE INDEX IF NOT EXISTS validator_transaction_players_player_idx ON :APP_SCHEMA.validator_transaction_players USING btree (player);
CREATE INDEX IF NOT EXISTS validator_transaction_players_player_block_type_idx ON :APP_SCHEMA.validator_transaction_players USING btree (player ASC, block_num ASC, type ASC);
CREATE INDEX IF NOT EXISTS validator_transaction_players_block_type_idx ON :APP_SCHEMA.validator_transaction_players USING btree (block_num ASC, type ASC) WHERE success AND is_owner IS TRUE;

DROP TABLE :APP_SCHEMA.validator_transaction_players_temp;

COMMIT;
