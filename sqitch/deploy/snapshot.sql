-- Deploy splinterlands-validator:snapshot to pg
-- requires: validators
-- requires: appschema

BEGIN;

-- Call the pre-snapshot function to clear out any existing snapshot data
SELECT snapshot.pre_snapshot_restore();

\i :snapshot_file

-- Call the post-snapshot function to move the snapshot data into the main tables
SELECT snapshot.post_snapshot_restore();

COMMIT;
