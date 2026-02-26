-- Deploy rental_delegations table to pg

BEGIN;

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.rental_delegations
(
    id                          character varying (100)         NOT NULL,
    promise_type                character varying (50)          NOT NULL,
    promise_ext_id              character varying (100)         NOT NULL,
    lender                      character varying (50)          NOT NULL,
    borrower                    character varying (50)          NOT NULL,
    token                       character varying (20)          NOT NULL,
    qty                         numeric(15, 3)                  NOT NULL,
    expiration_block            integer                         NOT NULL,
    start_block                 integer                         NOT NULL,
    expiration_blocks           integer                         NOT NULL,
    status                      character varying (20)          NOT NULL DEFAULT 'active',
    created_date                timestamptz                     NOT NULL,
    updated_date                timestamptz                     NOT NULL,
    CONSTRAINT rental_delegations_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_rental_delegations_status_expiration
    ON :APP_SCHEMA.rental_delegations (status, expiration_block)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_rental_delegations_lender
    ON :APP_SCHEMA.rental_delegations (lender)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_rental_delegations_borrower
    ON :APP_SCHEMA.rental_delegations (borrower)
    WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_rental_delegations_promise
    ON :APP_SCHEMA.rental_delegations (promise_type, promise_ext_id);

GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.rental_delegations TO :APP_USER;

COMMIT;
