-- Deploy splinterlands-validator:snapshot-function to pg
-- requires: snapshot-tables

BEGIN;

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
		account_name, is_active, post_url, total_votes, missed_blocks, reward_account
	)
    SELECT account_name, is_active, post_url, total_votes, missed_blocks, reward_account
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

   	IF p_archive_flag IS true THEN

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

	    INSERT INTO snapshot.validator_transaction_players (transaction_id, player)
	    SELECT transaction_id, player
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

		-- copy all promises
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
	ELSE
		-- only promise, block and token_unstaking tables are copied if archive is false

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
	    FROM token_unstaking
	    WHERE is_active IS true;

        -- we only need up to the last_checked_block when we're not getting an archive snapshot
		SELECT
			((SELECT MAX(block_num) FROM validator.blocks) - value::INTEGER)
		INTO
			v_limit
		FROM
			config
		WHERE
			group_name = 'validator' AND
			NAME = 'last_checked_block';

		INSERT INTO snapshot.blocks
		(
			block_num, block_id, prev_block_id, l2_block_id, block_time, validator, validation_tx
		)
	    SELECT
			block_num, block_id, prev_block_id, l2_block_id, block_time, validator, validation_tx
	    FROM
			blocks
	    ORDER BY
			block_num DESC
		LIMIT
			v_limit;

		-- copy only open promises

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
	        promise
		WHERE
			status IN ('open', 'fulfilled');

		-- pull promise_history for records in snapshot schema promise.  This ensures integrity for the snapshot file
    	INSERT INTO snapshot.promise_history (id, promise_id, action, player, previous_status, new_status, trx_id, created_date)
	    SELECT
	        ph.id,
	        ph.promise_id,
	        ph.action,
	        ph.player,
	        ph.previous_status,
	        ph.new_status,
	        ph.trx_id,
	        ph.created_date
	    FROM
	        promise_history ph
		INNER JOIN
			snapshot.promise p
			ON ph.promise_id = p.id;

	END IF;
END;
END;
$BODY$;

COMMIT;
