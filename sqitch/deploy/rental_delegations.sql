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

-- Config for delegation rental qty divisor (offers/bids must be in multiples of this)
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value)
VALUES ('delegation_rental', 'object', 'qty_divisor', 0, 'number', '500')
ON CONFLICT DO NOTHING;

-- Config for delegation rental minimum quantity
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value)
VALUES ('delegation_rental', 'object', 'min_qty', 0, 'number', '500')
ON CONFLICT DO NOTHING;

-- Snapshot table for rental_delegations
CREATE TABLE IF NOT EXISTS snapshot.rental_delegations
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
    updated_date                timestamptz                     NOT NULL
);

-- Update pre_snapshot_restore to clear the new snapshot table
CREATE OR REPLACE FUNCTION snapshot.pre_snapshot_restore(p_data_schema text DEFAULT :'APP_SCHEMA'::text)
    RETURNS void
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
BEGIN

	PERFORM set_config('search_path', regexp_replace(p_data_schema ||', public', '[^\w ,]', '', 'g'), true);

	RAISE NOTICE 'Data source schema: %', p_data_schema;

    -- Delete any pre-existing snapshot data
    TRUNCATE TABLE snapshot.token_unstaking;
    TRUNCATE TABLE snapshot.hive_accounts;
    TRUNCATE TABLE snapshot.balances;
    TRUNCATE TABLE snapshot.balance_history;
    TRUNCATE TABLE snapshot.staking_pool_reward_debt;
    TRUNCATE TABLE snapshot.validator_votes;
    TRUNCATE TABLE snapshot.validators;
    TRUNCATE TABLE snapshot.validator_vote_history;
    TRUNCATE TABLE snapshot.blocks;
    TRUNCATE TABLE snapshot.validator_transactions;
    TRUNCATE TABLE snapshot.validator_transaction_players;
    TRUNCATE TABLE snapshot.price_history;
    TRUNCATE TABLE snapshot.active_delegations;
    TRUNCATE TABLE snapshot.validator_check_in;
    TRUNCATE TABLE snapshot.promise;
    TRUNCATE TABLE snapshot.promise_history;
    TRUNCATE TABLE snapshot.config;
    TRUNCATE TABLE snapshot.token_transfer_keys;
    TRUNCATE TABLE snapshot.rental_delegations;
END;
$BODY$;

CREATE OR REPLACE FUNCTION snapshot.post_snapshot_restore(p_data_schema text DEFAULT :'APP_SCHEMA'::text)
    RETURNS void
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
DECLARE
    v_min_block_number    bigint;
    v_max_block_number    bigint;
    v_block_partition_ids bigint[];
BEGIN

	PERFORM set_config('search_path', regexp_replace(p_data_schema ||', public', '[^\w ,]', '', 'g'), true);

	RAISE NOTICE 'Data source schema: %', p_data_schema;

    -- special handling for partitioned tables
    SELECT MIN(block_num) INTO v_min_block_number FROM snapshot.blocks;
    IF v_min_block_number IS NULL THEN
        v_min_block_number := 0;
    END IF;

    SELECT MAX(block_num) INTO v_max_block_number FROM snapshot.blocks;
    IF v_max_block_number IS NULL THEN
        v_max_block_number := 432000 * 5;
    END IF;

    SELECT
        array(
            SELECT generate_series(
                v_min_block_number,
                v_max_block_number,
                432000
            )
        )
    INTO v_block_partition_ids;

    -- create the new partitions first
    PERFORM partman.create_partition_id(p_data_schema || '.blocks', v_block_partition_ids);
    PERFORM partman.create_partition_id(p_data_schema || '.validator_transactions', v_block_partition_ids);
    PERFORM partman.create_partition_id(p_data_schema || '.validator_transaction_players', v_block_partition_ids);

    -- run maintenance to clean up any old partitions and add new ones.
    -- note: if the node is an archive node, we will have some empty partitions at block 0. this shouldnt cause any issues but
    -- it'd be nice if we could get rid of them in the future
    PERFORM partman.run_maintenance(p_analyze := TRUE, p_jobmon := FALSE);

    INSERT INTO blocks SELECT * FROM snapshot.blocks;
    INSERT INTO validator_transactions SELECT * FROM snapshot.validator_transactions;
    INSERT INTO validator_transaction_players SELECT * FROM snapshot.validator_transaction_players;

    -- partman will premake the remaining future partitions and drop any old ones
    PERFORM partman.run_maintenance(p_analyze := TRUE, p_jobmon := FALSE);

    INSERT INTO active_delegations SELECT * FROM snapshot.active_delegations;
    INSERT INTO balance_history SELECT * FROM snapshot.balance_history;
    INSERT INTO balances SELECT * FROM snapshot.balances;
    -- Clear config so snapshot config takes precedence over any existing config
    TRUNCATE TABLE config;
    INSERT INTO config SELECT * FROM snapshot.config;
    INSERT INTO hive_accounts SELECT * FROM snapshot.hive_accounts;
    INSERT INTO price_history SELECT * FROM snapshot.price_history;
    INSERT INTO staking_pool_reward_debt SELECT * FROM snapshot.staking_pool_reward_debt;
    INSERT INTO validator_votes SELECT * FROM snapshot.validator_votes;
    INSERT INTO validator_vote_history SELECT * FROM snapshot.validator_vote_history;
    INSERT INTO validators SELECT * FROM snapshot.validators;
    INSERT INTO token_unstaking SELECT * FROM snapshot.token_unstaking;
    INSERT INTO validator_check_in SELECT * FROM snapshot.validator_check_in;
    INSERT INTO token_transfer_keys SELECT * FROM snapshot.token_transfer_keys;
    INSERT INTO rental_delegations SELECT * FROM snapshot.rental_delegations;

    -- special handling for serial keyed tables
    INSERT INTO promise SELECT * FROM snapshot.promise;
    INSERT INTO promise_history SELECT * FROM snapshot.promise_history;
    -- set the sequence values for the serial columns
    PERFORM setval(p_data_schema || '.promise_id_seq', (SELECT MAX(id) FROM promise), true);
    PERFORM setval(p_data_schema || '.promise_history_id_seq', (SELECT MAX(id) FROM promise_history), true);

    TRUNCATE TABLE snapshot.balances;
    TRUNCATE TABLE snapshot.balance_history;
    TRUNCATE TABLE snapshot.hive_accounts;
    TRUNCATE TABLE snapshot.staking_pool_reward_debt;
    TRUNCATE TABLE snapshot.validator_votes;
    TRUNCATE TABLE snapshot.validator_vote_history;
    TRUNCATE TABLE snapshot.validators;
    TRUNCATE TABLE snapshot.blocks;
    TRUNCATE TABLE snapshot.validator_transactions;
    TRUNCATE TABLE snapshot.validator_transaction_players;
    TRUNCATE TABLE snapshot.token_unstaking;
    TRUNCATE TABLE snapshot.price_history;
    TRUNCATE TABLE snapshot.config;
    TRUNCATE TABLE snapshot.active_delegations;
    TRUNCATE TABLE snapshot.validator_check_in;
    TRUNCATE TABLE snapshot.promise;
    TRUNCATE TABLE snapshot.promise_history;
    TRUNCATE TABLE snapshot.token_transfer_keys;
    TRUNCATE TABLE snapshot.rental_delegations;

END;
$BODY$;

CREATE OR REPLACE FUNCTION snapshot.freshsnapshot(
	p_archive_flag boolean DEFAULT false,
	p_data_schema text DEFAULT :'APP_SCHEMA'::text)
    RETURNS void
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
BEGIN
	DECLARE v_limit INTEGER;
BEGIN
    -- Delete any pre-existing snapshot data
    TRUNCATE snapshot.token_unstaking;					-- archive flag
    TRUNCATE snapshot.hive_accounts;					--
    TRUNCATE snapshot.balances;						--
    TRUNCATE snapshot.balance_history;					-- archive flag
    TRUNCATE snapshot.staking_pool_reward_debt;		--
    TRUNCATE snapshot.validator_votes; 				--
    TRUNCATE snapshot.validators; 						--
    TRUNCATE snapshot.validator_vote_history; 			--
    TRUNCATE snapshot.blocks;							-- archive flag
    TRUNCATE snapshot.validator_transactions;			-- archive flag
    TRUNCATE snapshot.validator_transaction_players;	-- archive flag
    TRUNCATE snapshot.price_history;					-- archive flag
    TRUNCATE snapshot.active_delegations;				-- archive flag
    TRUNCATE snapshot.validator_check_in;				-- archive flag
    TRUNCATE snapshot.promise;							-- archive flag
    TRUNCATE snapshot.promise_history;					-- archive flag
	TRUNCATE snapshot.config;							--
    TRUNCATE snapshot.token_transfer_keys;
    TRUNCATE snapshot.rental_delegations;


	-- Set search path to get data schema
	-- all references must use the schema name if not in the user default search path

	PERFORM set_config('search_path', regexp_replace(p_data_schema ||', public', '[^\w ,]', '', 'g'), true);

	RAISE NOTICE 'Data source schema: %', p_data_schema;

	INSERT INTO snapshot.hive_accounts (name, authority)
    SELECT ha.name, ha.authority FROM hive_accounts ha;

    INSERT INTO snapshot.balances (player, token, balance) SELECT player, token, balance FROM balances;

    INSERT INTO snapshot.staking_pool_reward_debt (player, pool_name, reward_debt)
    SELECT player, pool_name, reward_debt
    FROM staking_pool_reward_debt;

    INSERT INTO snapshot.validator_votes (voter, validator, vote_weight)
    SELECT voter, validator, vote_weight
    FROM validator_votes;

    INSERT INTO snapshot.validators
	(
		account_name, is_active, post_url, total_votes, missed_blocks, reward_account, api_url, last_version, consecutive_missed_blocks
	)
    SELECT account_name, is_active, post_url, total_votes, missed_blocks, reward_account, api_url, last_version, consecutive_missed_blocks
    FROM validators;

    INSERT INTO snapshot.validator_vote_history
	(
		transaction_id, created_date, voter, validator, is_approval, vote_weight
	)
    SELECT transaction_id, created_date, voter, validator, is_approval, vote_weight
    FROM validator_vote_history;

	INSERT INTO snapshot.config
	(
		group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx
	)
	SELECT
		group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx
	FROM
		config;

	INSERT INTO snapshot.token_unstaking (player, unstake_tx, unstake_start_date, is_active, token, total_qty,
	                                      next_unstake_date, total_unstaked, unstaking_periods,
	                                      unstaking_interval_seconds, cancel_tx)
	SELECT player,
	       unstake_tx,
	       unstake_start_date,
	       is_active,
	       token,
	       total_qty,
	       next_unstake_date,
	       total_unstaked,
	       unstaking_periods,
	       unstaking_interval_seconds,
	       cancel_tx
	FROM token_unstaking;
	INSERT INTO snapshot.blocks
	(
		block_num, block_id, prev_block_id, l2_block_id, block_time, validator, validation_tx
	)
	SELECT
		block_num, block_id, prev_block_id, l2_block_id, block_time, validator, validation_tx
	FROM
		blocks
	ORDER BY
		block_num DESC;

	INSERT INTO snapshot.validator_transactions (
	    id,
	    block_id,
	    prev_block_id,
	    type,
	    player,
	    data,
	    success,
	    error,
	    block_num,
        index,
	    created_date,
	    result
	)
	SELECT
	    id,
	    block_id,
	    prev_block_id,
	    type,
	    player,
	    data,
	    success,
	    error,
	    block_num,
        index,
	    created_date,
	    result
	FROM
	    validator_transactions;

	INSERT INTO snapshot.validator_transaction_players (transaction_id, player, block_num, is_owner, success, type)
	SELECT transaction_id, player, block_num, is_owner, success, type
	FROM validator_transaction_players;

	INSERT INTO snapshot.price_history (validator, token, block_num, block_time, token_price)
	SELECT validator, token, block_num, block_time, token_price
	FROM price_history;

	INSERT INTO snapshot.active_delegations
	(
		delegator, delegatee, amount, token, last_delegation_tx, last_delegation_date, last_undelegation_date, last_undelegation_tx
	)
	SELECT
		delegator, delegatee, amount, token, last_delegation_tx, last_delegation_date, last_undelegation_date, last_undelegation_tx
	FROM
		active_delegations;

	INSERT INTO snapshot.validator_check_in (account, status, last_check_in_block_num, last_check_in)
	SELECT
		account, status, last_check_in_block_num, last_check_in
	FROM
		validator_check_in;

	INSERT INTO snapshot.balance_history (player, token, amount, balance_start, balance_end, block_num, trx_id, type, created_date, counterparty)
    SELECT
        player,
        token,
        amount,
        balance_start,
        balance_end,
        block_num,
        trx_id,
        type,
        created_date,
        counterparty
    FROM
        balance_history;

	INSERT INTO snapshot.promise (id, ext_id, type, status, params, controllers, fulfill_timeout_seconds, fulfilled_by, fulfilled_at, fulfilled_expiration, created_date, updated_date)
	SELECT
	    id,
	    ext_id,
	    type,
	    status,
	    params,
	    controllers,
	    fulfill_timeout_seconds, fulfilled_by,
	    fulfilled_at,
	    fulfilled_expiration,
	    created_date,
	    updated_date
	FROM
	    promise;

    INSERT INTO snapshot.promise_history (id, promise_id, action, player, previous_status, new_status, trx_id, created_date)
	SELECT
	    id,
	    promise_id,
	    action,
	    player,
	    previous_status,
	    new_status,
	    trx_id,
	    created_date
	FROM
	    promise_history;

    INSERT INTO snapshot.token_transfer_keys (account, key, trx_id, block_num, block_time)
    SELECT account, key, trx_id, block_num, block_time
    FROM token_transfer_keys;

    INSERT INTO snapshot.rental_delegations (id, promise_type, promise_ext_id, lender, borrower, token, qty, expiration_block, start_block, expiration_blocks, status, created_date, updated_date)
    SELECT id, promise_type, promise_ext_id, lender, borrower, token, qty, expiration_block, start_block, expiration_blocks, status, created_date, updated_date
    FROM rental_delegations;
END;
END;
$BODY$;

CREATE OR REPLACE FUNCTION snapshot.slimifysnapshot(p_data_schema text DEFAULT :'APP_SCHEMA'::text)
    RETURNS void
    LANGUAGE 'plpgsql'
    COST 100
    VOLATILE PARALLEL UNSAFE
AS $BODY$
BEGIN
    DECLARE v_min_block_num INTEGER;
BEGIN
    -- Make sure we have data first
    PERFORM set_config('search_path', regexp_replace(p_data_schema ||', public', '[^\w ,]', '', 'g'), true);
    RAISE NOTICE 'Data source schema: %', p_data_schema;
    SELECT INTO v_min_block_num COALESCE(MAX(block_num), 0) - 432000 FROM snapshot.blocks;
    IF v_min_block_num < 0 THEN
        RAISE NOTICE 'No data to slimify. Did you run a fresh snapshot first?';
        RETURN;
    END IF;

    RAISE NOTICE 'Slimify snapshot to block num >= %', v_min_block_num;

    DELETE FROM snapshot.blocks WHERE block_num < v_min_block_num;
    DELETE FROM snapshot.validator_transactions WHERE block_num < v_min_block_num;
    DELETE FROM snapshot.validator_transaction_players WHERE block_num < v_min_block_num;

END;
END;
$BODY$;

COMMIT;
