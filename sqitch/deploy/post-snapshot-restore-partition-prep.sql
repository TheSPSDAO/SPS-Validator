-- Deploy splinterlands-validator:post-snapshot-restore-function to pg

BEGIN;

-- fix a previous issue with the partman retention policy when you have no retention set
UPDATE
  partman.part_config
SET
  retention=NULLIF(retention, '')::text;

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
    INSERT INTO config SELECT * FROM snapshot.config;
    INSERT INTO hive_accounts SELECT * FROM snapshot.hive_accounts;
    INSERT INTO price_history SELECT * FROM snapshot.price_history;
    INSERT INTO staking_pool_reward_debt SELECT * FROM snapshot.staking_pool_reward_debt;
    INSERT INTO validator_votes SELECT * FROM snapshot.validator_votes;
    INSERT INTO validator_vote_history SELECT * FROM snapshot.validator_vote_history;
    INSERT INTO validators SELECT * FROM snapshot.validators;
    INSERT INTO token_unstaking SELECT * FROM snapshot.token_unstaking;
    INSERT INTO validator_check_in SELECT * FROM snapshot.validator_check_in;

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

END;
$BODY$;

COMMIT;
