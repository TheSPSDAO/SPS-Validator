-- Deploy splinterlands-validator:pre-snapshot-function to pg

BEGIN;

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
END;
$BODY$;


COMMIT;
