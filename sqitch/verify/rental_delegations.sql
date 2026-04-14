-- Verify rental_delegations table

BEGIN;

SELECT id, promise_type, promise_ext_id, lender, borrower, token, qty,
       expiration_block, start_block, expiration_blocks, status,
       created_date, updated_date
FROM :APP_SCHEMA.rental_delegations
WHERE FALSE;

ROLLBACK;
