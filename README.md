# SPS Validator

To update an existing node to a new release, see [updating your node](#updating-your-node).

## Easy Install (mac or linux only):
Easy install will run through the setup steps for you, but requires the following to be installed on your machine:

- [curl](https://curl.se/download.html) installed. curl will most likely already be installed or available on your linux distros package manager, so try googling "install curl on {distro}" if you don't already have it.
- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) installed.
- [docker](https://docs.docker.com/desktop/setup/install/mac-install/) installed if you are on mac.

Run the following in a bash shell in your home directory once the above are installed. It will run through an interactive setup where you can define your validator account / key and then start the validator. If you already have docker installed, make sure your user has access to the docker group (`sudo usermod -aG docker "$(whoami)"`). Otherwise you'll have to run this command as root.

```
bash -c "$(curl -s https://raw.githubusercontent.com/TheSPSDAO/SPS-Validator/refs/tags/vlatest/install.sh)"
```

You should still look through the manual setup steps so you understand how to stop/start your node and configure it.

## Table of Contents

- [Getting started with Docker (manual setup)](#getting-started-with-docker-manual-setup)
    - [Manual Setup Prerequisites](#manual-setup-prerequisites)
    - [Manual Setup Instructions](#manual-setup-instructions)
    - [Registering your node](#registering-your-node)
    - [Staking your licenses for LICENSE rewards](#staking-your-licenses-for-license-rewards)
    - [Price Feed](#price-feed)
    - [Known Bugs](#known-bugs)
    - [Starting over from a fresh snapshot](#starting-over-from-a-fresh-snapshot)
    - [Snapshots](#snapshots)
    - [Commands Reference](#commands-reference)
- [Updating your node](#updating-your-node)
    - [block-hash-stable updates](#block-hash-stable)
    - [block-hash-breaking updates](#block-hash-breaking)
    - [schema-breaking updates](#schema-breaking)
- [Local development](#local-development)
    - [Plugins](#plugins)
    - [Testing](#testing)
- [Deployment](#deployment)
- [Common problems](#common-problems)
- [Useful links](#useful-links)
- [About the repository](#about-the-repository)
    - [Libraries](#libraries)
    - [Apps](#apps)

## Getting started with Docker (manual setup)

### Manual Setup Prerequisites:

- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) installed
- Make sure you have `docker`, `docker-compose` and either wget or curl installed. (`./run.sh install_docker` and `./run.sh preinstall` on Linux)
- If you're on Windows, WSL + Docker Desktop is recommended. See [installing WSL](https://learn.microsoft.com/en-us/windows/wsl/install) and [installing Docker Desktop](https://docs.docker.com/desktop/features/wsl/)
- Copy .env-example to .env (`cp .env-example .env`) and change it accordingly
- _(Optional)_ Either add `validator-data-latest.zip` into the `sqitch` folder or have it downloaded in the build step

### Manual Setup Instructions

- `git clone --branch vlatest --single-branch https://github.com/TheSPSDAO/SPS-Validator.git` : Clone the repository
- `cd SPS-Validator`  : Change directory to the validator repository
- `./run.sh stop`     : Ensure the validator is not currently running.
- `cp .env-example .env`: If you haven't already run this. This will copy the default settings. You should update the new `.env` file with your `VALIDATOR_ACCOUNT` and `VALIDATOR_KEY` (posting). If you are JUST looking to earn license rewards, you should also set the `DB_BLOCK_RETENTION` variable to a minimum of `432000` to keep your database size small.
- `./run.sh build`    : Build the validator.  This will deploy the database, run migrations and also download/deploy the snapshot.
- _(Note)_: If you receive an error like `Got permission denied while trying to connect to the Docker daemon socket`, follow the steps [here](https://docs.docker.com/engine/install/linux-postinstall/#manage-docker-as-a-non-root-user).
- `./run.sh start` or `./run.sh start all` : Start the validator. `all` will start the management UI as well.
- You can go to http://localhost:3333/status to check that the validator is running.
- You can go to http://localhost:8888/ to view the management UI if you used the `all` option when starting.

### Registering your node

- Set the `VALIDATOR_ACCOUNT` and `VALIDATOR_KEY` (posting key) environment variables in your .env file if you haven't.
- If you've already started your node, run `./run.sh rebuild_service validator` to apply the new environment variables if you changed them.
- Go to the management ui, http://localhost:8888/validator-nodes/manage, and follow the registration steps. Post URL is NOT required. If you want to direct your rewards to another account (block validation and license rewards), you can set the reward account for your node during registration.
- _(Note)_ If you have just restored from a snapshot, you will have to wait until your node catches up before your UI will see you as registered. You can use the shared management UI here which will most likely be caught up: https://thespsdao.github.io/SPS-Validator/validator-nodes/manage.
- _(Note)_ The first time you register, your node will be set to "inactive", and you will not be considered for block validation.
- After you've registered and your local node is caught up, you can set your node to active on the Manage Validator Node page.
- _(Note)_ When you're node is caught up, you will see log messages like this: `2025-01-13 14:49:27 [310b590] 1/13/2025, 7:49:27 PM - Processing block [92411242], Head Block: 92411242, Blocks to head: 0.`
- You are now registered and will be considered for block validation. You can use the Manage Votes page to vote on yourself and others.
- _(Note)_ If you have to take your node down for any reason, or it is down for some reason, you should set it to Inactive on the Manage Validator Node page so you are not considered for block validation. If you are chosen for a block, and your node is down, you will receive a "missed block" for that block, which could affect who votes for your node.

### Staking your licenses for LICENSE rewards

- Set the `VALIDATOR_ACCOUNT` and `VALIDATOR_KEY` (posting key) environment variables in your .env file if you haven't.
- Register your node using the instructions in the README.
- _(Optional)_ If you set a reward account when registering your node, that account must have staked licenses.
- If you've already started your node, run `./run.sh rebuild_service validator` to apply the new environment variables if you changed them.
- Go to the splinterlands license management page here, https://splinterlands.com/dashboard/licenses, and click `STAKE LICENSES`.
- Once you've staked your licenses, and you have the environment variables set, your node will start sending check ins to prove you are running the software so you can receive rewards.

### Price Feed

The top validators will be responsible for the SPS price feed inside the validator. The DAO provides a free price feed to the validator network that the validator nodes will use by default. To avoid a single source of truth for the SPS price however, you can purchase API keys to either coingecko or coin market cap and set them in your .env file. If you are not a top validator, you do not have to do this.
```
# one or the other, or both. a random feed is picked to get the sps price every N blocks.
PRICE_FEED_COIN_GECKO_API_KEY=
# set to true if you are using a coin gecko demo api key
# PRICE_FEED_COIN_GECKO_DEMO=true
PRICE_FEED_COIN_MARKET_CAP_API_KEY=
```

Once those are set, you can run `./run.sh rebuild_service validator` to apply them.

### Known Bugs

- If your node is running and licenses are then staked for its `VALIDATOR_ACCOUNT` or reward account, it is not picking up the change and starting the check in process. You can resolve this by restarting your node after you've staked your licenses.

### Starting over from a fresh snapshot

- Make sure you set your node to inactive before replaying.
- Set the new `SNAPSHOT_URL` in your .env file.
- `./run.sh replay`:  :warning: **This will irrevocably destroy all local data, including blocks that have already been locally validated**: Be very careful here!

### Snapshots

You can take snapshots locally to take backups, and restore them without uploading them to the internet.

- `./run.sh snapshot`: This will bring down your node while the snapshot runs.
- You will get a `snapshot.zip` file in the git repositories root directory.
- You can either upload this zip to a publicly accessible URL and share it, or just restore it locally.
- To restore it locally, copy the `snapshot.zip` file into `./sqitch/validator-data-latest.zip`. (`cp ./snapshot.zip ./sqitch/validator-data-latest.zip`)
- `./run.sh replay`: enter "n" when it asks if you want to download a fresh snapshot.

### Commands Reference

- `./run.sh stop`: stops the database, validator, and ui if running
- `./run.sh <pg | validator | ui>`: stops the specific service
- `./run.sh start`: starts the database and validator
- `./run.sh start all`: starts either the database, validator, and ui
- `./run.sh restart`: helpful wrapper around `./run.sh stop` and `./run.sh start`
- `./run.sh logs`: trails the last 30 lines of logs
- `./run.sh snapshot`: stops the validator and creates a snapshot of the database. this snapshot can be uploaded and used to restore another validator.
- `./run.sh rebuild_service <validator | pg | ui>`: force rebuilds a service to apply new environment variables.
- `./run.sh replay`: rebuilds your node from the snapshot. :warning: **This will irrevocably destroy all local data, including blocks that have already been locally validated**: Be very careful here!
- `./run.sh destroy`: completely removes the database, validator, and ui. :warning: **This will irrevocably destroy all local data, including blocks that have already been locally validated**: Be very careful here!
- `./run.sh status`: checks your validator node status and registration status (running/active/inactive)

## Updating your node

There are different steps you need to take to update your node depending on the update. There are three types of updates:
- "block-hash-stable" updates. These are updates that you don't need to apply. They normally add additional endpoints to the validator API, or improve or fix bugs with the installation scripts.
- "block-hash-breaking" updates. These are updates that you must apply before their scheduled "go-live" block. If your node is not updated before the go-live block, your node's block hash will be different, and you will not earn rewards.
- "schema-breaking" updates. These are updates you must apply before their scheduled "go-live" block, but you must apply them on the *block before* the go-live block.

You can find update guides for the different updates below. The type of update will be specified in the GitHub Release and the DAOs PeakD post.

**You should set your node to inactive before updating so you don't miss any blocks.**

### block-hash-stable

block-hash-stable updates are updates that don't affect the block hash. These are normally additional API endpoints or install script improvements.

- Pull the latest version with `git fetch --tags -f && git checkout v{version}`.
- `./run.sh rebuild_service validator` to rebuild the validator with the latest updates. This will also start the validator.
- `./run.sh rebuild_service ui` if you want to rebuild the UI.
  
### block-hash-breaking

block-hash-breaking updates are designed to turn on at a certain block, so all you need to do is make sure you've updated and restarted your node before the go-live block.

- Pull the latest version with `git fetch --tags -f && git checkout v{version}` *before*.
- `./run.sh rebuild_service validator` to rebuild the validator with the latest updates. This will also start the validator.
- `./run.sh rebuild_service ui` if you want to rebuild the UI.

### schema-breaking

schema-breaking updates cannot be applied before the go-live block. To apply a schema-breaking update, follow the steps below.

- Set `KILL_BLOCK` in your .env file to the scheduled updates block number and rebuild your node (`./run.sh rebuild_service validator`).
- As the kill block gets closer, you should set your node to inactive.
- When the `KILL_BLOCK` hits, your node will stop.
- `./run.sh stop` so your node stops restarting itself.
- _(Note)_ You can run `./run.sh snapshot` to take a backup of your database before updating to be safe. If you need to restore this snapshot, see [snapshots](#snapshots).
- You can now pull the latest version with `git fetch --tags -f && git checkout v{version}`.
- `./run.sh build` to apply the latest database updates. When it asks if you want to download a new snapshot, you can enter "n".
- Remove the `KILL_BLOCK` from your .env file
- `./run.sh rebuild_service validator` to rebuild the validator with the latest updates. This will also start the validator.
- `./run.sh rebuild_service ui` if you want to rebuild the UI.

## Local development

For local development, simply run `./run.sh start db` instead of `./run.sh start` after the setup instructions.

- Make sure you have `node` installed.
- Run `npm i && npm run build sps-validator` to install dependencies and build the dependencies and the sps-validator itself
- Copy `.env-example` to `.env` if you haven't and make any desired local changes
- Run `npm start sps-validator` to run the validator process.

### Plugins

The validator library supports plugins which are called after each plugin this way you can attach plugins locally to perform
other work. The LICENSE reward pool is partially implemented as a plugin and a good starting point.

Attaching a plugin
```typescript
const dispatcher = PluginDispatcherBuilder.create().addPlugin(coolPlugin).build();
```
Then pass the `dispatcher` to the `EntryPoint` constructor and you're good to go!

See the `SimpleLogPlugin` as an example of how to implement the `Plugin` interface.


### Testing

- `./run.sh build`: Make sure you database is setup
- `POSTGRES_DB={APP_DATABASE env var} npm run dump-structure`: Dumps the schema for tests. You will need pg_dump v16 installed.
- `npm test <project>`: run tests in the project

## Deployment
The created Docker images should be configurable via environment variables. 
We use convict for managing our environment variables.

To enable some rudimentary health probes, set both the `API_PORT` to a
valid port and `HEALTH_CHECKER` to a boolean-esque string, such as
`'true'`. 

You can subsequently see the endpoints probes at:
- `http://<host>:<API_PORT>/health-check/readiness`
- `http://<host>:<API_PORT>/health-check/liveness`

Some example output of the readiness endpoint on a local deployment:
```json
{
  "name":"SPS Validator Node",
  "status":true
  "date":"2022-05-20T16:20:04.197Z"
}
```

You can check either the `status` key in that reponse, or the HTTP status code of the response to see if the system is still working as it should.
The current 'healthy' code is 200, the 'unhealthy' code is 503.

## Common problems
If you run into linting or building errors after a `git pull`, make sure you have no lingering `node_modules` lying around.
The _only_ node_modules that you should need are:
- `node_modules`, after `npm install`

## Useful links
- [sqitch documentation](https://sqitch.org/docs/)

## About the repository

### Libraries

- validator
  - the main validator block processor.
- monad
- atom

### Apps
- sps-validator
- sps-validator-ui
