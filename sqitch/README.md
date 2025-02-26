# Instructions for release.

Add your changes using `./sqitch add` like normal. Snapshots contain the latest sqitch change they were taken with. When restoring a snapshot, we deploy up until the change from the snapshot, restore our snapshot, then apply any changes after the snapshot's change. This allows us to use older snapshots on newer versions of the validator without problems.
