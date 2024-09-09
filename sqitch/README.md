# Instructions for release.
See `staggered-deploy.sh` for a runnable description of how to deploy the migrations contained in this directory.

The short of it that there will always be a (moving) `pre-snapshot` migration, which is intended to be the point at which a recently-dumped validator snapshot could be restored without any SQL errors.
During a development cycle, new structural changes can be added on top of the latest pre-snapshot migration, and the staggered-deploy script will ensure that things happen in the supported order.
Just before a release, the `pre-snapshot` migration should be reworked.

The steps for this include:
- `sqitch tag my-release-tag`
- `sqitch rework pre-snapshot`
- edit `sqitch/deploy/pre-snapshot.sql` in _any_ way so the file hash is distinct (there should be a counter in the comment that can just be incremented).
