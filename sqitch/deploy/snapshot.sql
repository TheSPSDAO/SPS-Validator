-- Deploy splinterlands-validator:snapshot to pg
-- requires: validators
-- requires: appschema

BEGIN;
\i :snapshot_file

-- Copied from new_db_config.sql;
-- Can be removed once snapshots contain config data as well.
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('validator', 'object', 'max_votes', 0, 'number', '10', '2022-01-20 14:55:53.32528', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('validator', 'object', 'max_block_age', 0, 'number', '100', '2022-01-20 14:55:53.32528', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('validator', 'object', 'min_validators', 0, 'number', '3', '2022-01-20 14:55:53.32528', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('validator', 'object', 'reward_start_block', 0, 'number', '60963785', '2022-01-20 14:55:53.32528', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('validator', 'object', 'tokens_per_block', 0, 'number', '4.34', '2022-01-20 14:55:53.32528', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('validator', 'object', 'reduction_blocks', 0, 'number', '864000', '2022-01-20 14:55:53.32528', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('validator', 'object', 'reduction_pct', 0, 'number', '1', '2022-01-20 14:55:53.32528', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('$root', 'object', 'proxy_accounts', 0, 'array', '["sl-proxy-1", "sl-proxy-2", "sl-proxy-3", "sl-proxy-4", "sl-proxy-5"]', '2020-10-14 13:40:41.068322', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('sps', 'object', 'staking_rewards', 0, 'object', '{ "tokens_per_block": 8.56164, "reduction_blocks": 864000, "reduction_pct": 1, "start_block": 56186000, "unstaking_periods": 4, "unstaking_interval_seconds": 604800 }', '2021-07-23 19:44:31.554835', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('$root', 'object', 'admin_accounts', 0, 'array', '["sl-admin-1", "sl-admin-2", "sl-admin-3", "sl-admin-4", "sl-admin-5"]', '2021-07-27 17:10:16.532421', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('sps', 'object', 'staking_rewards_last_reward_block', 0, 'number', '61103010', '2021-07-23 19:44:31.554835', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('sps', 'object', 'staking_rewards_acc_tokens_per_share', 0, 'number', '0.4523962116972181', '2021-07-23 19:44:31.554835', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('sps', 'object', 'staking_rewards_voucher', 0, 'object', '{ "tokens_per_block": 0.69444, "start_block": 63712974, "unstaking_periods": 4, "unstaking_interval_seconds": 604800 }', '2021-07-23 19:44:31.554835', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('sps', 'object', 'staking_rewards_voucher_last_reward_block', 0, 'number', '63712974', '2021-07-23 19:44:31.554835', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('sps', 'object', 'staking_rewards_voucher_acc_tokens_per_share', 0, 'number', '0', '2021-07-23 19:44:31.554835', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('sps', 'object', 'inflation_pools', 0, 'array', '[]', '2022-07-09 09:44:31.554835', NULL) ON CONFLICT DO NOTHING;
INSERT INTO :APP_SCHEMA.config (group_name, group_type, name, index, value_type, value, last_updated_date, last_updated_tx) VALUES ('sps', 'object', 'token_records', 0, 'array', '[]', '2022-07-21 18:22:32.554835', NULL) ON CONFLICT DO NOTHING;

COMMIT;
