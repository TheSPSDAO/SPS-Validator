-- Deploy splinterlands-validator:running-validator-reward-pool to pg
BEGIN;

-- NOTE: there are no unstaking settings because you can't unstake the "running validator" token
CREATE TYPE :APP_SCHEMA.validator_check_in_status AS ENUM ('active', 'inactive');

CREATE TABLE :APP_SCHEMA.validator_check_in (
    account text NOT NULL,
    status :APP_SCHEMA.validator_check_in_status NOT NULL,
    last_check_in_block_num integer NOT NULL,
    last_check_in timestamp without time zone NOT NULL,
    PRIMARY KEY (account)
);

CREATE INDEX idx_validator_check_in_last_check_in_status ON :APP_SCHEMA.validator_check_in USING btree (last_check_in_block_num ASC, status);

COMMIT;
