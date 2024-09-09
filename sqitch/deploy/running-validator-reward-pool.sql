-- Deploy splinterlands-validator:running-validator-reward-pool to pg
BEGIN;

INSERT INTO
    :APP_SCHEMA.config (
        group_name,
        group_type,
        name,
        index,
        value_type,
        value,
        last_updated_date,
        last_updated_tx
    )
VALUES
    (
        'sps',
        'object',
        'validator_rewards',
        0,
        'object',
        '{ "tokens_per_block": 3.90625, "reduction_blocks": 864000, "reduction_pct": 1, "start_block": 67857521 }',
        '2021-07-23 19:44:31.554835',
        NULL
    ) ON CONFLICT DO NOTHING;

INSERT INTO
    :APP_SCHEMA.config (
        group_name,
        group_type,
        name,
        index,
        value_type,
        value,
        last_updated_date,
        last_updated_tx
    )
VALUES
    (
        'sps',
        'object',
        'validator_rewards_last_reward_block',
        0,
        'number',
        '88644162',
        '2024-09-04 19:44:31.554835',
        NULL
    );

INSERT INTO
    :APP_SCHEMA.config (
        group_name,
        group_type,
        name,
        index,
        value_type,
        value,
        last_updated_date,
        last_updated_tx
    )
VALUES
    (
        'sps',
        'object',
        'validator_rewards_acc_tokens_per_share',
        0,
        'number',
        '0',
        '2024-09-04 19:44:31.554835',
        NULL
    );

INSERT INTO
    :APP_SCHEMA.config (
        group_name,
        group_type,
        name,
        index,
        value_type,
        value,
        last_updated_date,
        last_updated_tx
    )
VALUES
    (
        'validator_check_in',
        'object',
        'check_in_window_blocks',
        0,
        'number',
        '300',
        '2024-09-04 19:44:31.554835',
        NULL
    );

INSERT INTO
    :APP_SCHEMA.config (
        group_name,
        group_type,
        name,
        index,
        value_type,
        value,
        last_updated_date,
        last_updated_tx
    )
VALUES
    (
        'validator_check_in',
        'object',
        'check_in_interval_blocks',
        0,
        'number',
        '28800',
        '2024-09-04 19:44:31.554835',
        NULL
    );

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