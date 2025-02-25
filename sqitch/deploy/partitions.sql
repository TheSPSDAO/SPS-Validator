-- Deploy splinterlands-validator:partitions to pg

BEGIN;

-- enable partman
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;

-- BLOCKS --

-- copy the blocks table into a temp table
CREATE TABLE :APP_SCHEMA.blocks_temp AS
SELECT * FROM :APP_SCHEMA.blocks;

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
)
PARTITION BY RANGE (block_num);

-- create the partitions
SELECT partman.create_parent(
    p_parent_table := :'APP_SCHEMA' || '.blocks',
    p_control := 'block_num'::text,
    p_interval := '432000'::text,
    p_start_partition := (SELECT MIN(block_num) FROM :APP_SCHEMA.blocks_temp)::text
);

-- set retention policy
UPDATE partman.part_config
SET retention_keep_table = 'false', retention_keep_index = 'false', retention=COALESCE(:'DB_BLOCK_RETENTION', NULL)::text
WHERE parent_table = :'APP_SCHEMA' || '.blocks';

-- copy the data back into the new table
INSERT INTO :APP_SCHEMA.blocks
SELECT * FROM :APP_SCHEMA.blocks_temp;

CREATE INDEX IF NOT EXISTS blocks_validator_idx ON :APP_SCHEMA.blocks USING btree (validator);

DO
$$
    BEGIN
        RAISE NOTICE 'blocks table partitioned - blocks_temp still exists and must be dropped manually.';
    END
$$;

-- TRANSACTIONS --

-- copy the transactions table into a temp table
CREATE TABLE :APP_SCHEMA.validator_transactions_temp AS
SELECT * FROM :APP_SCHEMA.validator_transactions;

-- drop the blocks table
DROP TABLE :APP_SCHEMA.validator_transactions;

-- create the transactions table with partitions
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
    block_num     integer                 NOT NULL,
    index         smallint                NOT NULL,
    created_date  timestamp without time zone,
    result        text compression lz4
)
PARTITION BY RANGE (block_num);

CREATE TABLE :APP_SCHEMA.validator_transactions_template (LIKE :APP_SCHEMA.validator_transactions);
ALTER TABLE :APP_SCHEMA.validator_transactions_template ADD PRIMARY KEY (id);

-- create the partitions
SELECT partman.create_parent(
    p_parent_table := :'APP_SCHEMA' || '.validator_transactions',
    p_control := 'block_num'::text,
    p_interval := '432000'::text,
    p_start_partition := (SELECT MIN(block_num) FROM :APP_SCHEMA.validator_transactions_temp)::text,
    p_template_table := :'APP_SCHEMA' || '.validator_transactions_template'::text
);

-- set retention policy
UPDATE partman.part_config
SET retention_keep_table = 'false', retention_keep_index = 'false', retention=COALESCE(:'DB_BLOCK_RETENTION', NULL)::text
WHERE parent_table = :'APP_SCHEMA' || '.validator_transactions';

-- copy the data back into the new table
INSERT INTO :APP_SCHEMA.validator_transactions
SELECT * FROM :APP_SCHEMA.validator_transactions_temp;

CREATE INDEX IF NOT EXISTS validator_transactions_block_num_idx ON :APP_SCHEMA.validator_transactions USING btree (block_num, index ASC);
CREATE INDEX IF NOT EXISTS validator_transactions_created_date_idx ON :APP_SCHEMA.validator_transactions USING btree (created_date);
CREATE INDEX IF NOT EXISTS validator_transactions_type_player_idx ON :APP_SCHEMA.validator_transactions USING btree (player, type);

DO
$$
    BEGIN
        RAISE NOTICE 'transactions table partitioned - validator_transactions_temp still exists and must be dropped manually.';
    END
$$;


-- TRANSACTION PLAYERS --

-- copy the transactions table into a temp table
CREATE TABLE :APP_SCHEMA.validator_transaction_players_temp AS
SELECT * FROM :APP_SCHEMA.validator_transaction_players;

-- drop the blocks table
DROP TABLE :APP_SCHEMA.validator_transaction_players;

-- create the transactions table with partitions
CREATE TABLE :APP_SCHEMA.validator_transaction_players
(
    transaction_id character varying(100) NOT NULL,
    player         character varying(50)  NOT NULL,
    block_num      integer NOT NULL,
    is_owner       boolean NOT NULL,
    success        boolean,
    type           character varying(100) NOT NULL
)
PARTITION BY RANGE (block_num);

CREATE TABLE :APP_SCHEMA.validator_transaction_players_template (LIKE :APP_SCHEMA.validator_transaction_players);
ALTER TABLE :APP_SCHEMA.validator_transaction_players_template ADD PRIMARY KEY (transaction_id, player);

-- create the partitions
SELECT partman.create_parent(
    p_parent_table := :'APP_SCHEMA' || '.validator_transaction_players',
    p_control := 'block_num'::text,
    p_interval := '432000'::text,
    p_start_partition := (SELECT MIN(block_num) FROM :APP_SCHEMA.validator_transaction_players_temp)::text,
    p_template_table := :'APP_SCHEMA' || '.validator_transaction_players_template'::text
);

-- set retention policy
UPDATE partman.part_config
SET retention_keep_table = 'false', retention_keep_index = 'false', retention=COALESCE(:'DB_BLOCK_RETENTION', NULL)::text
WHERE parent_table = :'APP_SCHEMA' || '.validator_transaction_players';

-- copy the data back into the new table
INSERT INTO :APP_SCHEMA.validator_transaction_players
SELECT * FROM :APP_SCHEMA.validator_transaction_players_temp;

CREATE INDEX IF NOT EXISTS validator_transaction_players_player_idx ON :APP_SCHEMA.validator_transaction_players USING btree (player);
CREATE INDEX IF NOT EXISTS validator_transaction_players_player_block_type_idx ON :APP_SCHEMA.validator_transaction_players USING btree (player ASC, block_num ASC, type ASC);
CREATE INDEX IF NOT EXISTS validator_transaction_players_block_type_idx ON :APP_SCHEMA.validator_transaction_players USING btree (block_num ASC, type ASC) WHERE success AND is_owner IS TRUE;

DO
$$
    BEGIN
        RAISE NOTICE 'transaction players table partitioned - validator_transaction_players_temp still exists and must be dropped manually.';
    END
$$;


COMMIT;
