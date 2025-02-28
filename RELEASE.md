## Creating Releases

When master branch is ready to be released:
- Update the `VERSION=` variable in install.sh to `v{version}`.
- Create a new branch named `release-{version}` from the master branch. 
- Tests should run on the release branch.
- Create a new release on the new branch, the tag should match the `VERSION=` variable you set (`v{version}`)
- Force create/push a new tag, `vlatest`, pointed to the new branch.
