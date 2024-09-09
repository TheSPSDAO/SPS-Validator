#!/usr/bin/env bash
set -euo pipefail
IFS=$'\n\t'

SCRIPT_NAME=$0
TMP_TEMPLATE="${TMPDIR:-/tmp/}$(basename "$0").XXXXXXXXXXXX"

function usage {
    echo "usage: $SCRIPT_NAME [-h] FILE [ENV]"
    echo "  -h      display help"
    echo "  FILE    snapshot zip file"
    echo "  [ENV]   output file for parsed LAST_BLOCK, in dotenv format"
    echo "  Required environment variables:"
    echo "    - SNAPSHOT - where to extract the snapshot SQL file."
}

while getopts ":h" option; do
   case $option in
      h) # Display usage instructions
         usage
         exit;;
      *) # Unsupported flag
         usage
         exit 1;;
   esac
done

if [ -z ${SNAPSHOT+x} ]
then
  echo "SNAPSHOT is unset."
  usage
  exit 1
fi

if [ -z ${1+x} ]
then
  echo "FILE was not provided."
  usage
  exit 1
fi

FILE="$1"

if [ ! -f "$FILE" ]; then
  echo "FILE $FILE does not seem to be a file"
  usage
  exit 1
fi

if [ -n "${2+x}" ]
then
  ENV="$2"
fi

unzip_dir=$(mktemp -d "$TMP_TEMPLATE")
unzip "$FILE" -d "$unzip_dir"
snapshot_file=$(find "$unzip_dir" -maxdepth 1 -type f -name "*.sql" | head -n 1)
# replace random line of text in the latest snapshot that breaks sqitch
sed -i 's/.*Last Transaction Block Number.*//' "$snapshot_file"
# we'll have to update the snapshot process to not include the schema. for now im doing a dumb replace that isn't perfect
sed -i "s/public\./${APP_SCHEMA}\./" "$snapshot_file"
base_snapshot=$(basename -- "$snapshot_file")
base_snapshot="${base_snapshot%.*}"
SNAPSHOT_LAST_BLOCK=$(echo "$base_snapshot" | awk -F_ '{print $3}')

if [ -z "$SNAPSHOT_LAST_BLOCK" ]; then
    echo "Snapshot did not seem to have an embedded block number, using default from env."
else
    if [ -n "${ENV+x}" ]; then
       echo "LAST_BLOCK=${SNAPSHOT_LAST_BLOCK}" > "${ENV}"
    fi
    ((SNAPSHOT_LAST_BLOCK++))
    START_BLOCK=${SNAPSHOT_LAST_BLOCK}
    echo "Start block is $START_BLOCK"
fi

mv "$snapshot_file" "$SNAPSHOT"
rm -r "$unzip_dir"
