# SPS Validator
## Getting started with Docker

You need to re-build the validator when getting started or when updating to a newer release.

### Prerequisites:

- Make sure you have `docker`, `docker-compose` and either wget or curl installed. (`bash run.sh install_docker` and `bash run.sh preinstall` on Linux)
- Copy .env-example to .env (`cp .env-example .env`) and change it accordingly
- _(Optional)_ Either add `validator-data-latest.zip` into the `sqitch` folder or have it downloaded in the build step.

### Setup Instructions

- `bash run.sh stop`     : Ensure the validator is not currently running (`bash run.sh stop`)
- `bash run.sh build`    : Build the validator.  This will deploy the database, run migrations and also download/deploy the snapshot.
- `bash run.sh start`    : Start the validator.
- `bash run.sh start all`: Start the validator and the ui.

### Additional Commands

- `bash run.sh restart`: helpful wrapper around `run.sh stop` and `run.sh start`
- `bash run.sh logs`: trails the last 30 lines of logs

### Starting over from a fresh snapshot

- `bash run.sh replay`:  :warning: **This will irrevocably destroy all local data, including blocks that have already been locally validated**: Be very careful here!

## Local development

For local development, simply run `bash run.sh start db` instead of `bash run.sh start` after the setup instructions.

- Make sure you have `node` installed.
- Run `npm i && npm run build sps-validator` to install dependencies and build the dependencies and the sps-validator itself
- Navigate to the `apps/sps-validator` folder, copy `.env.example` to `.env` and make any desired local changes
- Run `npm start sps-validator` to run the validator process.

### Plugins

The validator library supports plugins which are called after each plugin this way you can attach plugins locally to perform
other work.

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
- `ui/node_modules`, after `cd ui; npm install`

The following are usually problematic, and should be removed or renamed at your convenience:
- `validator/node_modules`

## Useful links
- [sqitch documentation](https://sqitch.org/docs/)

## About the repository

### Libraries

- validator
  - the main validator block processor.
- monad

### Apps
- sps-validator
