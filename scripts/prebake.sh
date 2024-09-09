#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

# Requires:
# - GNU cut
# - bc
# - bash v4+
# - GNU getopt
# - (GNU?) AWK
# - sed
# - sqitch

# TLDR: install GNU/Linux, git gud

usage() {
    echo >&2 "Prebake your sqitch deploy and validate scripts so they are just Plain Old SQL."
    echo >&2 ""
    echo >&2 "Usage:"
    echo >&2 "  $0 --dest-dir OUTPUT [--work-dir WORK_DIR] [--prefix prefix] [--set VAR=VAL]* [-- <passthrough>]"
    echo >&2 ""
    echo >&2 "Options:"
    echo >&2 "  --dest-dir OUTPUT     : directory where output will be stored. Will clobber on file name collision."
    echo >&2 "  [--work-dir WORK_DIR] : directory where bundle will be stored. Default: bundle"
    echo >&2 "  [--prefix PREFIX]     : prefix for generated SQL files. Default: current date in YYYYMMDD"
    echo >&2 "  [--set VAR=VAL]...    : used for a simple text-based replace in the sql file"
    echo >&2 "  [--]                  : delineate end of argument parsing"
    echo >&2 "  <passthrough>         : arguments passed to sqitch for creating the bundle"
    echo >&2 ""
    echo >&2 "Example:"
    echo >&2 "  $0 --dest-dir output-directory --set LAST_BLOCK=7331 -- --skip=1 --max-count=3"
    echo >&2 ""
    exit
}

options=$(getopt -o h --longoptions dest-dir:,work-dir:,prefix:,set: -- "$@") || usage
eval set -- "$options"

declare setArgs=()
sedBuilder() {
    echo "$1" | awk '{gsub( "[:'=']","/"); print "s/:" $0 "/g;"}'
}

sedRunner() {
    if [ ${#setArgs[@]} -eq 0 ]; then
        cat
    else
        sed "${setArgs[*]}"
    fi
}

while true; do
    case "$1" in
    -h)
        usage
        ;;
    --dest-dir)
        shift # The arg is next in position args
        FINAL_DIR="$1"
        ;;
    --work-dir)
        shift # The arg is next in position args
        WORK_DIR="$1"
        ;;
    --prefix)
        shift # The arg is next in position args
        PREFIX="$1"
        ;;
    --set)
        shift # The arg is next in position args
        declare sedStatement
        sedStatement=$(sedBuilder "$1")
        setArgs+=("$sedStatement")
        ;;
    --)
        shift
        break
        ;;
    *)
        # Should not happen
        echo >&2 "This should really not be happening :D"
        usage
        ;;
    esac
    shift
done

[ -z "${FINAL_DIR:-}" ] && usage
mkdir -p "$FINAL_DIR"

# Accepts a float argument; returns the amount of decimals needed to represent this number
spacing() {
    echo "scale=0; 2*l(${1})/l(10) + 1" | bc -l
}

# Returns the current date in YYYYMMDD format
default_prefix() {
    printf '%(%Y%m%d)T' -1
}

WORK_DIR="${WORK_DIR:-bundle}"
PREFIX="${PREFIX:-$(default_prefix)}"

# First argument: working directory
create_bundle() {
    sqitch bundle --dest-dir="$1"
}

# First arg: directory
# Second arg: prefix
# Third arg: scaled (number of digits)
# Fourth arg: index number
# Fifth arg: migration name
# Sixth arg: suffix
fname() {
    declare pretty
    pretty=$(printf "%0${3}d" "$4")
    echo "${1}/${2}_${pretty}_${5}_${6}.sql"
}

# First argument: Working directory
# rest argument: passthrough arguments for sqitch plan
myloop() {
    # TODO: when sqitch errors out here, it does not give a proper status code?
    declare wd OUTPUT CHANGES SIZE scaled
    wd="$1"
    shift
    OUTPUT=$(sqitch plan --cd "$wd" --oneline --no-pager --no-header "$@" | cut -d " " -f 3)
    readarray -t CHANGES <<<"$OUTPUT"
    SIZE="${#CHANGES[@]}"
    scaled=$(spacing "$SIZE")
    declare -i i=1
    for C in "${CHANGES[@]}"; do
        declare deploy n deploy_target verify verify_target

        deploy="${wd}/deploy/$C.sql"
        n=$((i++))
        deploy_target=$(fname "$FINAL_DIR" "$PREFIX" "$scaled" "$n" "$C" deploy)
        sedRunner <"$deploy" >"$deploy_target"

        verify="${wd}/verify/$C.sql"
        n=$((i++))
        verify_target=$(fname "$FINAL_DIR" "$PREFIX" "$scaled" "$n" "$C" verify)
        sedRunner <"$verify" >"$verify_target"
    done
}

# TODO: from to breaks with plan; just tweak the sqitch bundle invocation instead for now
create_bundle "$WORK_DIR"
myloop "$WORK_DIR" "$@"
