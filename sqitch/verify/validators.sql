-- Verify splinterlands-validator:validators on pg

BEGIN;

-- XXX Add verifications here.
SELECT account_name, is_active, post_url, total_votes, missed_blocks
FROM :APP_SCHEMA.validators
WHERE FALSE;

SELECT voter, validator, vote_weight
FROM :APP_SCHEMA.validator_votes
WHERE FALSE;

SELECT transaction_id, created_date, voter, validator, is_approval, vote_weight
FROM :APP_SCHEMA.validator_vote_history
WHERE FALSE;

ROLLBACK;
