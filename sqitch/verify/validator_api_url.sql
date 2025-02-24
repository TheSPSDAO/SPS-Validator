-- Verify splinterlands-validator:validator_api_url on pg

BEGIN;

SELECT account_name, is_active, post_url, total_votes, missed_blocks, api_url, last_version
FROM :APP_SCHEMA.validators
WHERE FALSE;

SELECT account_name, is_active, post_url, total_votes, missed_blocks, api_url, last_version
FROM snapshot.validators
WHERE FALSE;

ROLLBACK;
