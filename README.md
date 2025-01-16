# SPS Validator
## Getting started with Docker

You need to re-build the validator when getting started or when updating to a newer release.

### Prerequisites:

- A linux distro (if you're on windows, WSL will work)
- [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git) installed
- Make sure you have `docker`, `docker-compose` and either wget or curl installed. (`./run.sh install_docker` and `./run.sh preinstall` on Linux)
- Copy .env-example to .env (`cp .env-example .env`) and change it accordingly
- _(Optional)_ Either add `validator-data-latest.zip` into the `sqitch` folder or have it downloaded in the build step.

### Setup Instructions

- `git clone https://github.com/TheSPSDAO/SPS-Validator.git` : Clone the repository
- `cd SPS-Validator`  : Change directory to the validator repository
- `./run.sh stop`     : Ensure the validator is not currently running.
- `./run.sh build`    : Build the validator.  This will deploy the database, run migrations and also download/deploy the snapshot.
- `./run.sh start` or `./run.sh start all` : Start the validator. `all` will start the management UI as well.
- You can go to `http://localhost:3333/status` to check that the validator is running.
- You can go to `http://localhost:8888/` to view the management UI if you used the `all` option when starting.

### Registering your node

- Set the `VALIDATOR_ACCOUNT` and `VALIDATOR_KEY` (active key) environment variables in your .env file
- _(Optional)_ Set `REWARD_ACCOUNT` to the account that you want to receive the block validation rewards.
- If you've already started your node, run `./run.sh rebuild_service validator` to apply the new environment variables
- Go to the management ui, http://localhost:8888/validator-nodes/manage, and follow the registration steps. Post URL is NOT required.
- _(Note)_ If you have just restored from a snapshot, you will have to wait until your node catches up before your UI will see you as registered. You can use the shared management UI here which will most likely be caught up: https://thespsdao.github.io/SPS-Validator/validator-nodes/manage.
- _(Note)_ The first time you register, your node will be set to "inactive", and you will not be considered for block validation.
- After you've registered and your local node is caught up, you can set your node to active on the Manage Validator Node page.
- _(Note)_ When you're node is caught up, you will see log messages like this: `2025-01-13 14:49:27 [310b590] 1/13/2025, 7:49:27 PM - Processing block [92411242], Head Block: 92411242, Blocks to head: 0.`
- You are now registered and will be considered for block validation. You can use the Manage Votes page to vote on yourself and others.
- _(Note)_ If you have to take your node down for any reason, or it is down for some reason, you should set it to Inactive on the Manage Validator Node page so you are not considered for block validation. If you are chosen for a block, and your node is down, you will receive a "missed block" for that block, which could affect who votes for your node.

### Staking your licenses for LICENSE rewards

- Set the `VALIDATOR_ACCOUNT` and `VALIDATOR_KEY` (active key) environment variables in your .env file
- _(Optional)_ Set `REWARD_ACCOUNT` to the account that you want to receive the license rewards. The `REWARD_ACCOUNT` must have a staked license to receive rewards. If you do not set a `REWARD_ACCOUNT`, then the `VALIDATOR_ACCOUNT` must have a staked license.
- _(Note)_ LICENSE rewards do not require you to register your node, only that you have a staked license.
- If you've already started your node, run `./run.sh rebuild_service validator` to apply the new environment variables
- Go to the splinterlands license management page here, https://validator.qa.splinterlands.com/dashboard/licenses, and click `STAKE LICENSES`.
- Once you've staked your licenses, and you have the environment variables set, your node will start sending check ins to prove you are running the software so you can receive rewards.

### Known Bugs

- If your node is running and licenses are then staked for its `VALIDATOR_ACCOUNT` or `REWARD_ACCOUNT`, it is not picking up the change and starting the check in process. You can resolve this by restarting your node after you've staked your licenses.

### Additional Commands

- `./run.sh restart`: helpful wrapper around `./run.sh stop` and `./run.sh start`
- `./run.sh logs`: trails the last 30 lines of logs
- `./run.sh snapshot`: stops the validator and creates a snapshot of the database. this snapshot can be uploaded and used to restore another validator.

### Starting over from a fresh snapshot

- `./run.sh replay`:  :warning: **This will irrevocably destroy all local data, including blocks that have already been locally validated**: Be very careful here!

## Local development

For local development, simply run `./run.sh start db` instead of `./run.sh start` after the setup instructions.

- Make sure you have `node` installed.
- Run `npm i && npm run build sps-validator` to install dependencies and build the dependencies and the sps-validator itself
- Copy `.env.example` to `.env` if you haven't and make any desired local changes
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
Run tests with `npm test <project>`.

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
