#!/usr/bin/env bash
# set -euo pipefail
IFS=$'\n\t'

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

rebuild_validator() {
    echo "Rebuilding $DOCKER_NAME validator"
    docker compose down
    docker compose up -d --build validator
    logs
}

start() {
    echo "Starting $DOCKER_NAME"
    if [[ $1 == "db" ]]; then
        docker compose up -d pg
        elif [[ $1 == "all" ]]; then
        docker compose up -d
        logs
    else
        docker compose up -d validator
        logs
    fi
}

stop() {
    echo "Stopping & removing $DOCKER_NAME"
    docker compose down
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
        start
    fi
}

# skip-snapshot works technically, but will result in a broken build
build() {
    if [[ $1 == "skip-snapshot" ]] || [[ $2 == "skip-snapshot" ]]; then
        echo "Skipping snapshot"
        echo "Running migrations. This could take several minutes..."
        if [[ $1 == "no-cache" ]] || [[ $2 == "no-cache" ]]; then
            docker compose build --no-cache validator-sqitch
        else
            docker compose build validator-sqitch
        fi
    else
        dl_snapshot "$1"
        echo "Running migrations. This could take several minutes..."
        if [[ $1 == "no-cache" ]] || [[ $2 == "no-cache" ]]; then
            docker compose build --build-arg snapshot="$SNAPSHOT_FILE" --no-cache validator-sqitch
        else
            docker compose build --build-arg snapshot="$SNAPSHOT_FILE" validator-sqitch
        fi
    fi
    docker compose --profile cli -f "${COMPOSE_FILE}" run validator-sqitch
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
    docker compose logs validator -f --tail 30
}

help() {
    echo "Usage: $0 COMMAND"
    echo
    echo "Commands: "
    echo "    start       - starts docker"
    echo "    update      - updates validator config"
    echo "    stop        - stops docker"
    echo "    restart     - runs stop + start"
    echo "    destroy     - runs stop and deletes local database"
    echo "    replay      - stops docker (if exists), deletes local database and runs build + start"
    echo "    build       - runs dl_snapshot + database migrations"
    echo "    dl_snapshot - downloads snapshot if it doesn't exists locally"
    echo "    logs        - trails the last 30 lines of logs"
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
    rebuild_validator)
        rebuild_validator
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
    config)
        config
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
    *)
        echo "Invalid CMD"
        help
    ;;

esac
