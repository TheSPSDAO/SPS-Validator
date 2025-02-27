# Instructions for release.

Add your changes using `./sqitch add` like normal. Snapshots contain the latest sqitch change they were taken with. When restoring a snapshot, we deploy up until the change from the snapshot, restore our snapshot, then apply any changes after the snapshot's change. This allows us to use older snapshots on newer versions of the validator without any issues.

The snapshot restoration will call a pre and post restore function that are responsible for clearing out the snapshot tables before restore, and moving the snapshot table data into the main tables. If a database change added a new table or a new column, those functions must be updated to handle the new table/column. If an older snapshot is restored on a newer version, the pre/post snapshot functions will always be at a version that works with that snapshot.
