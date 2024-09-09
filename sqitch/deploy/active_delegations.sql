-- Deploy active_delegations table to pg

BEGIN;

CREATE TABLE IF NOT EXISTS :APP_SCHEMA.active_delegations
(
    token                       character varying (20)          NOT NULL,
    delegator                   character varying (50)          NOT NULL,
    delegatee                   character varying (50)          NOT NULL,
    amount                      numeric(15, 3)                  NOT NULL,
    last_delegation_tx          character varying (100)         NOT NULL,
    last_delegation_date        timestamptz                     NOT NULL,
    last_undelegation_date      timestamptz                     NULL,
    last_undelegation_tx        character varying (100)         NULL,
    CONSTRAINT active_delegations_pkey PRIMARY KEY (token, delegator, delegatee)
);

GRANT SELECT, INSERT, UPDATE ON TABLE :APP_SCHEMA.active_delegations TO :APP_USER;

COMMIT;
