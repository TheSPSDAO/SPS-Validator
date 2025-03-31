## Creating Releases

When master branch is ready to be released:
- Update the `VERSION=` variable in install.sh to `v{version}`.
- Update the VERSION variable in the docker-compose files validator service
- Create a new branch named `release-{version}` from the previous release branch. 
- Create a PR from master to the new branch and review the changes. The tests will run.
- Create a new release on the new branch, the tag should match the `VERSION=` variable you set (`v{version}`)
- Force create/push a new tag, `vlatest`, pointed to the new branch.
