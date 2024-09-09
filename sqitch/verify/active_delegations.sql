-- Verify splinterlands-validator:active_delegations on pg

BEGIN;

SELECT token,
       delegator,
       delegatee,
       amount,
       last_delegation_tx,
       last_delegation_date,
       last_undelegation_date,
       last_undelegation_tx
FROM active_delegations
WHERE FALSE;

ROLLBACK;
