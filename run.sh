#!/usr/bin/env bash
# set -euo pipefail
IFS=$'\n\t'

# try to match a tag, if not use the short commit hash
SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &>/dev/null && pwd)
SQITCH_DIR="$SCRIPT_DIR/sqitch"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"

if [[ -f ".env" ]]; then
    # shellcheck source=/dev/null
    source .env
else
    echo "Missing .env, copying example .env. Edit it before running this again."
    cp .env-example .env
    exit
fi

if [[ ! $DOCKER_NAME ]]; then
    echo "DOCKER_NAME not defined in the .env file"
    exit
fi

if [[ ! $SNAPSHOT_FILE ]]; then
    echo "SNAPSHOT_FILE not defined in the .env file"
    exit
fi

if [[ ! $SNAPSHOT_URL ]]; then
    echo "SNAPSHOT_URL not defined in the .env file"
    exit
fi

APP_SCHEMA=${APP_SCHEMA:-public}
APP_DATABASE=${APP_DATABASE:-validator}
APP_USER=${APP_USER:-validator}
APP_PASSWORD=${APP_PASSWORD:-validator}

docker_compose() {
    # not really useful anymore but leaving it in case it is needed
    docker compose "$@"
}

run_psql() {
    docker_compose exec pg psql -U "$APP_USER" -h 127.0.0.1 -d "$APP_DATABASE" "$@"
}

run_psql_quiet() {
    docker_compose exec -e PGOPTIONS="--client-min-messages=warning" pg psql -U "$APP_USER" -h 127.0.0.1 -d "$APP_DATABASE" "$@"
}

snapshot() {
    read -p "Creating a snapshot requires the validator to be stopped. Stop the validator? (y/n)" -n 1 -r
    echo    # (optional) move to a new line
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting snapshot"
        exit
    fi

    echo "Stopping validator"
    stop "validator"

    echo "Creating snapshot"
    # connect to the database and run the freshsnapshot() function
    run_psql -c "SELECT snapshot.freshsnapshot(TRUE);"

    # dump the snapshot to a file
    echo "Dumping snapshot to file"
    docker_compose exec -e PGPASSWORD="$APP_PASSWORD" pg pg_dump \
        --no-owner --no-acl \
        --no-comments --no-publications --no-security-labels \
        --schema snapshot \
        --no-subscriptions --no-tablespaces --data-only \
        --host "127.0.0.1" \
        --username "$APP_USER" \
        "${APP_DATABASE}" > snapshot.sql

    # get the latest change from the sqitch.changes table with psql
    CHANGE=$(run_psql -t -c "SELECT change FROM sqitch.changes WHERE project = 'splinterlands-validator' ORDER BY committed_at DESC LIMIT 1")
    # trim whitespace from the change
    CHANGE=$(echo "$CHANGE" | xargs echo -n)
    echo "Latest change: $CHANGE"
    # add to the beginning of the snapshot.sql file like -- to_change:$CHANGE
    sed -i "1s/^/-- to_change:$CHANGE\n/" snapshot.sql

    echo "Snapshot created. You can find it in snapshot.sql"

    read -p "Would you like to zip the snapshot? (y/n)" -n 1 -r
    echo    # (optional) move to a new line
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Zipping snapshot"
        zip snapshot.zip snapshot.sql
        echo "Snapshot zipped. You can find it in snapshot.zip"

        read -p "Would you like to remove the snapshot.sql file? (y/n)" -n 1 -r
        echo    # (optional) move to a new line
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            rm snapshot.sql
        fi
    fi

    read -p "Would you like to start the validator again? (y/n)" -n 1 -r
    echo    # (optional) move to a new line
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start
    fi
}

repartition_tables() {
    # confirm they want to do this
    echo "Repartioning only has to be done if your database existed before version v1.1.1, or if you have restored a snapshot from before that version."
    echo "Repartitioning will take a while and will lock the tables. It's not required, but you should stop your validator to be safe."
    read -p "Are you sure you want to repartition the tables? (y/n)" -n 1 -r
    echo    # (optional) move to a new line
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting repartition"
        exit
    fi

    _repartition_table "blocks"
    _repartition_table "validator_transactions"
    _repartition_table "validator_transaction_players"

    run_psql -q -c "CALL partman.run_maintenance_proc();"
}

_repartition_table() {
    echo "Repartitioning table $1 in schema $APP_SCHEMA"
    run_psql_quiet -q -c "CALL partman.partition_data_proc(p_parent_table := '$APP_SCHEMA'::text || '.$1'::text, p_interval := '432000'::text);"
    run_psql_quiet -q -c "VACUUM ANALYZE $APP_SCHEMA.$1;"
    echo "Repartitioned table $1 in schema $APP_SCHEMA"
}

rebuild_service() {
    echo "Rebuilding $DOCKER_NAME $1 service"
    docker_compose down "$1"
    docker_compose up -d --build "$1"
}

start() {
    echo "Starting $DOCKER_NAME"
    if [[ $1 == "db" ]]; then
        docker_compose up -d pg
    elif [[ $1 == "all" ]]; then
        docker_compose up -d
        logs
    elif [[ $1 == "all-silent" ]]; then
        docker_compose up -d
    elif [[ $1 == "validator-silent" ]]; then
        docker_compose up -d validator
    else
        docker_compose up -d validator
        logs
    fi
}

stop() {
    echo "Stopping & removing $DOCKER_NAME"
    if [[ -z $1 ]]; then
        docker_compose down
    else
        docker_compose down "$1"
    fi
}

restart() {
    stop
    start
}

destroy() {
    read -p "Are you sure you want to destroy? This will stop the current running container and remove the local database (including any locally validated blocks) (y/n)" -n 1 -r
    echo    # (optional) move to a new line
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        stop
        _destroy
    fi
}

_destroy() {
    docker volume ls --filter name="${DOCKER_NAME}*" -q | xargs -r docker volume rm || true # delete local database
    docker ps --filter name="${DOCKER_NAME}*" -aq | xargs -r docker rm || true # delete splinterlands containers
    docker images --filter=reference="${DOCKER_NAME}*" -q | xargs -r docker rmi || true # delete splinterlands images
}

replay() {
    read -p "Are you sure you want to replay? This will stop the current running container and remove the local database (including any locally validated blocks) (y/n)" -n 1 -r
    echo    # (optional) move to a new line
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        stop
        _destroy
        build "$1" "$2"
        start "all"
    fi
}

# skip-snapshot works technically, but will result in a broken build
build() {
    if [[ $1 == "skip-snapshot" ]] || [[ $2 == "skip-snapshot" ]]; then
        echo "Skipping snapshot"
        echo "Running migrations. This could take several minutes..."
        if [[ $1 == "no-cache" ]] || [[ $2 == "no-cache" ]]; then
            docker_compose build --no-cache validator-sqitch
        else
            docker_compose build validator-sqitch
        fi
    else
        dl_snapshot "$1"
        echo "Running migrations. This could take several minutes..."
        if [[ $1 == "no-cache" ]] || [[ $2 == "no-cache" ]]; then
            docker_compose build --build-arg snapshot="$SNAPSHOT_FILE" --no-cache validator-sqitch
        else
            docker_compose build --build-arg snapshot="$SNAPSHOT_FILE" validator-sqitch
        fi
    fi
    docker_compose --profile cli -f "${COMPOSE_FILE}" run validator-sqitch
}

dl_snapshot() {
    SNAPSHOT="$SQITCH_DIR/$SNAPSHOT_FILE"
    if [[ -f "$SNAPSHOT" ]]; then
        read -p "Snapshot file already exists. Do you want to replace it and download a new one? (y/n)" -n 1 -r
        echo    # (optional) move to a new line
        if [[ $REPLY =~ ^[Yy]$ ]]
        then
            sudo rm -f SNAPSHOT
            _dl_snapshot
        fi
    else
        _dl_snapshot
    fi
}

_dl_snapshot() {
    echo "Downloading snapshot now."
    if command -v "curl" &>/dev/null; then
        curl -sSL --output "$SNAPSHOT" "$SNAPSHOT_URL"
        elif command -v "wget" &>/dev/null; then
        wget --output-document "$SNAPSHOT" "$SNAPSHOT_URL"
    else
        echo "missing curl or wget - install manually or run.sh preinstall"
        exit
    fi
}

update() {
    TO_VERSION=${1:-vlatest}
    echo "Updating node to $TO_VERSION"

    # ask for confirmation to stop the validator
    read -p "Are you sure you want to update? This will stop the validator and checkout the latest update (y/n):" -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]
    then
        echo "Stopping validator"
        stop validator
        echo "Checking out latest update"
        git fetch --all -f

        if ! git checkout "$TO_VERSION"; then
            echo "Error checking out $TO_VERSION. Please check the version and try again. If you have local changes, please stash them before updating."
            echo "You can use the following command to stash your changes:"
            echo "git stash"
            echo "If you want to discard your changes, you can use the following command:"
            echo "git reset --hard HEAD"
            exit 1
        fi

        echo "Latest update checked out. Restarting node now."
        rebuild_service validator

        # ask if they want to rebuild the ui
        read -p "Would you like to rebuild the UI? (y/n):" -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]
        then
            rebuild_service ui
        fi

        echo "Update complete. Please check the logs to ensure everything is working correctly."
        echo "NOTE: If this is a version with a database migration, you may need to run the following command to apply the migration:"
        echo "./run.sh build"
        echo "Please check the release notes for more information."
    else
        echo "Update cancelled"
    fi
}

preinstall() {
    sudo apt update
    sudo apt install -y curl git wget xz-utils
}

install_docker() {
    sudo apt update
    sudo apt install -y curl git
    curl https://get.docker.com | sh
    if [ "$EUID" -ne 0 ]; then
        echo "Adding user $(whoami) to docker group"
        sudo usermod -aG docker "$(whoami)"
        echo "IMPORTANT: Please re-login (or close and re-connect SSH) for docker to function correctly"
    fi
}

# doesn't work correctly as it returns true if only the database runs and not the validator
container_exists() {
    containercount=$(docker compose ls --filter name="$DOCKER_NAME" | wc -l)
    if [[ $containercount -eq 2 ]]; then
        return 1
    else
        return 0
    fi
}

logs() {
    echo "DOCKER LOGS: (press ctrl-c to exit) "
    docker_compose logs validator -f --tail 30
}

status() {
  echo "Checking validator status..."

  VALIDATOR_ACC="$VALIDATOR_ACCOUNT"

  if [ -z "$VALIDATOR_ACC" ]; then
    echo "VALIDATOR_ACCOUNT not found in .env file"
    return 1
  fi

  LOCAL_INFO=$(curl -s --connect-timeout 3 http://localhost:3333/status 2>/dev/null)
  API_STATUS=$(echo "$LOCAL_INFO" | grep -o '"status":"[^"]*"' | cut -d':' -f2 | tr -d '"')

  if [ "$API_STATUS" = "running" ]; then
    LAST_BLOCK=$(echo "$LOCAL_INFO" | grep -o '"last_block":[0-9]*' | cut -d':' -f2)
    echo "- Node status: RUNNING"
    echo "- Last block: $LAST_BLOCK"
    echo "Your Node is synchronized"
    API_URL="http://localhost:3333"
  else
    echo "Your node isn't running properly. Using the external API instead."
    API_URL="https://splinterlands-validator-api.splinterlands.com"
  fi

  echo ""
  echo "Validator Account: $VALIDATOR_ACC"

  VALIDATORS_RESPONSE=$(curl -s $API_URL/validators)
  NODE_INFO=$(echo "$VALIDATORS_RESPONSE" | grep -o "{[^{]*\"account_name\":\"$VALIDATOR_ACC\"[^}]*}")

  echo -n "Validator node status: "

  if [[ $NODE_INFO == *'"is_active":true'* ]]; then
    echo "ACTIVE"
  elif [[ $NODE_INFO == *'"is_active":false'* ]]; then
    echo "INACTIVE"
  elif [ -z "$NODE_INFO" ]; then
    echo "Not registered or not found"

    if [ -z "$LOCAL_INFO" ]; then
      echo "(Make sure your node is running with './run.sh start')"
    else
      echo "(If you've just registered, it might take some time for the registration to be recognized)"
    fi
  else
    echo "Status unclear. Raw data: $NODE_INFO"
  fi
}

help() {
    echo "Usage: $0 COMMAND"
    echo
    echo "Commands: "
    echo "    start [db | all | all-silent] - starts docker. the default just starts the validator. db starts only the database. all starts everything"
    echo "    rebuild_service [service]     - rebuilds the service. service can be validator or ui"
    echo "    stop                          - stops docker"
    echo "    restart                       - runs stop + start"
    echo "    destroy                       - runs stop and deletes local database"
    echo "    replay                        - stops docker (if exists), deletes local database and runs build + start"
    echo "    build                         - runs dl_snapshot + database migrations"
    echo "    dl_snapshot                   - downloads snapshot if it doesn't exists locally"
    echo "    snapshot                      - creates a snapshot of the current database."
    echo "    logs                          - trails the last 30 lines of logs"
    echo "    status                        - checks your validator node status and registration status"
    echo "    repartition_tables            - helper command to repartition the partitioned database tables. only needed if upgrading a database from before v1.1.1 or if restoring a snapshot from before v1.1.1"
    echo "    psql [args]                   - runs psql with the given args. e.g. run.sh psql -c 'SELECT * FROM blocks'".
    echo "    update                        - updates your validator node to the latest version"
    echo
    echo "Helpers:"
    echo "    install_docker - install docker"
    echo "    preinstall     - installs required linux packages"
    echo
    exit
}

case $1 in
    start)
        start "$2"
    ;;
    rebuild_service)
        rebuild_service "$2"
    ;;
    stop)
        stop
    ;;
    restart)
        restart
    ;;
    destroy)
        destroy
    ;;
    replay)
        replay "$2" "$3"
    ;;
    build)
        build "$2" "$3"
    ;;
    dl_snapshot)
        dl_snapshot
    ;;
    snapshot)
        snapshot
    ;;
    logs)
        logs
    ;;
    install_docker)
        install_docker
    ;;
    help)
        help
    ;;
    status)
        status
    ;;
    repartition_tables)
        repartition_tables
    ;;
    psql)
        run_psql "${@:2}"
    ;;
    update)
        update "$2"
    ;;
    *)
        echo "Invalid CMD"
        help
    ;;

esac
