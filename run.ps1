$ErrorActionPreference = "Stop"
$script_dir = $(Split-Path -Parent $MyInvocation.MyCommand.Definition)
$sqitch_dir = "$script_dir/sqitch"
$compose_file = "$script_dir/docker-compose.yml"

if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        $name, $value = $_.split('=')
        if ([string]::IsNullOrWhiteSpace($name) -or $name.Contains('#')) {
            return
        }
        Set-Content env:\$name $value
    }
}
else {
    Write-Host "Missing .env, copying example .env. Edit it before running this again."
    Copy-Item .env-example .env
    exit
}

if (-not $env:DOCKER_NAME) {
    Write-Host "DOCKER_NAME not defined in the .env file"
    exit
}

if (-not $env:SNAPSHOT_FILE) {
    Write-Host "SNAPSHOT_FILE not defined in the .env file"
    exit
}

if (-not $env:SNAPSHOT_URL) {
    Write-Host "SNAPSHOT_URL not defined in the .env file"
    exit
}

function docker_compose_wrapper {
    docker compose @args
}

function snapshot {
    $response = Read-Host "Creating a snapshot requires the validator to be stopped. Stop the validator? (y/n)"
    if ($response -notmatch '^[Yy]$') {
        Write-Host "Aborting snapshot"
        exit
    }

    Write-Host "Stopping validator"
    stop "validator"

    $env:APP_DATABASE = $env:APP_DATABASE -or "validator"

    Write-Host "Creating snapshot"
    docker_compose_wrapper exec pg psql -U postgres -h 127.0.0.1 -d $env:APP_DATABASE -c "SELECT snapshot.freshsnapshot(TRUE);"

    Write-Host "Dumping snapshot to file"
    docker_compose_wrapper exec -e PGPASSWORD=$env:POSTGRES_PASSWORD pg pg_dump `
        --no-owner --no-acl --disable-triggers `
        --no-comments --no-publications --no-security-labels `
        --schema snapshot `
        --no-subscriptions --no-tablespaces --data-only `
        --host "127.0.0.1" `
        --username ($env:POSTGRES_USER -or "postgres") `
        $env:APP_DATABASE > snapshot.sql

    Write-Host "Snapshot created. You can find it in snapshot.sql"

    $response = Read-Host "Would you like to zip the snapshot? (y/n)"
    if ($response -match '^[Yy]$') {
        Write-Host "Zipping snapshot"
        Compress-Archive -Path snapshot.sql -DestinationPath snapshot.zip
        Write-Host "Snapshot zipped. You can find it in snapshot.zip"

        $response = Read-Host "Would you like to remove the snapshot.sql file? (y/n)"
        if ($response -match '^[Yy]$') {
            Remove-Item snapshot.sql
        }
    }

    $response = Read-Host "Would you like to start the validator again? (y/n)"
    if ($response -match '^[Yy]$') {
        _start
    }
}

function rebuild_service {
    param (
        [string]$service
    )
    Write-Host "Rebuilding $env:DOCKER_NAME $service service"
    docker_compose_wrapper down $service
    docker_compose_wrapper up -d --build $service
    logs
}

function _start {
    param (
        [string]$option
    )
    Write-Host "Starting $env:DOCKER_NAME"
    if ($option -eq "db") {
        docker_compose_wrapper up -d pg
    }
    elseif ($option -eq "all") {
        docker_compose_wrapper up -d
        logs
    }
    else {
        docker_compose_wrapper up -d validator
        logs
    }
}

function stop {
    param (
        [string]$service
    )
    Write-Host "Stopping & removing $env:DOCKER_NAME"
    if (-not $service) {
        docker_compose_wrapper down
    }
    else {
        docker_compose_wrapper down $service
    }
}

function restart {
    stop
    _start
}

function destroy {
    $response = Read-Host "Are you sure you want to destroy? This will stop the current running container and remove the local database (including any locally validated blocks) (y/n)"
    if ($response -match '^[Yy]$') {
        stop
        _destroy
    }
}

function _destroy {
    docker volume ls --filter name="$env:DOCKER_NAME*" -q | ForEach-Object { docker volume rm $_ }
    docker ps --filter name="$env:DOCKER_NAME*" -aq | ForEach-Object { docker rm $_ }
    docker images --filter=reference="$env:DOCKER_NAME*" -q | ForEach-Object { docker rmi $_ }
}

function replay {
    param (
        [string]$arg1,
        [string]$arg2
    )
    $response = Read-Host "Are you sure you want to replay? This will stop the current running container and remove the local database (including any locally validated blocks) (y/n)"
    if ($response -match '^[Yy]$') {
        stop
        _destroy
        build $arg1 $arg2
        _start "all"
    }
}

function build {
    param (
        [string]$arg1,
        [string]$arg2
    )
    Write-Host "Building..."
    if ($arg1 -eq "skip-snapshot" -or $arg2 -eq "skip-snapshot") {
        Write-Host "Skipping snapshot"
        Write-Host "Running migrations. This could take several minutes..."
        if ($arg1 -eq "no-cache" -or $arg2 -eq "no-cache") {
            docker_compose_wrapper build --no-cache validator-sqitch
        }
        else {
            docker_compose_wrapper build validator-sqitch
        }
    }
    else {
        dl_snapshot $arg1
        Write-Host "Running migrations. This could take several minutes..."
        if ($arg1 -eq "no-cache" -or $arg2 -eq "no-cache") {
            docker_compose_wrapper build --build-arg snapshot=$env:SNAPSHOT_FILE --no-cache validator-sqitch
        }
        else {
            docker_compose_wrapper build --build-arg snapshot=$env:SNAPSHOT_FILE validator-sqitch
        }
    }
    docker_compose_wrapper --profile cli -f $compose_file run validator-sqitch
}

function dl_snapshot {
    param (
        [string]$arg
    )
    $SNAPSHOT = "$sqitch_dir/$env:SNAPSHOT_FILE"
    if (Test-Path $SNAPSHOT) {
        $response = Read-Host "Snapshot file already exists. Do you want to replace it and download a new one? (y/n)"
        if ($response -match '^[Yy]$') {
            Remove-Item $SNAPSHOT
            _dl_snapshot
        }
    }
    else {
        _dl_snapshot
    }
}

function _dl_snapshot {
    Write-Host "Downloading snapshot now."
    Invoke-WebRequest $env:SNAPSHOT_URL -OutFile $SNAPSHOT
}

function container_exists {
    $containercount = docker compose ls --filter name=$env:DOCKER_NAME | Measure-Object -Line
    if ($containercount.Lines -eq 2) {
        return $true
    }
    else {
        return $false
    }
}

function logs {
    Write-Host "DOCKER LOGS: (press ctrl-c to exit)"
    docker_compose_wrapper logs validator -f --tail 30
}

function help {
    Write-Host "Usage: .\run.ps1 COMMAND"
    Write-Host ""
    Write-Host "Commands: "
    Write-Host "    start [db | all]          - starts docker. the default just starts the validator. db starts only the database. all starts everything"
    Write-Host "    rebuild_service [service] - rebuilds the service. service can be validator or ui"
    Write-Host "    stop                      - stops docker"
    Write-Host "    restart                   - runs stop + start"
    Write-Host "    destroy                   - runs stop and deletes local database"
    Write-Host "    replay                    - stops docker (if exists), deletes local database and runs build + start"
    Write-Host "    build                     - runs dl_snapshot + database migrations"
    Write-Host "    dl_snapshot               - downloads snapshot if it doesn't exists locally"
    Write-Host "    snapshot                  - creates a snapshot of the current database."
    Write-Host "    logs                      - trails the last 30 lines of logs"
    Write-Host ""
    Write-Host ""
    exit
}

switch ($args[0]) {
    "start" { _start $args[1] }
    "rebuild_service" { rebuild_service $args[1] }
    "stop" { stop $args[1] }
    "restart" { restart }
    "destroy" { destroy }
    "replay" { replay $args[1] $args[2] }
    "build" { build $args[1] $args[2] }
    "dl_snapshot" { dl_snapshot }
    "snapshot" { snapshot }
    "logs" { logs }
    "help" { help }
    default {
        Write-Host "Invalid CMD - $args[0]"
        help
    }
}
