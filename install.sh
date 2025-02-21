#!/bin/bash

# function to replace a KEY=VALUE pair in an env file
replace_env() {
    local key=$1
    local value=$2
    local file=$3
    # ignore lines that start with # or empty lines
    sed -i "s/^$key=.*/$key=$value/g" "$file"
}

# parse version from package.json
VERSION=release-$(sed 's/.*"version": "\(.*\)".*/\1/;t;d' ./package.json)
TARGET_DIR="SPS-Validator"

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting SPS Validator installation...${NC}"

# Check if the target directory doesnt exist or is empty
if [ -d "$TARGET_DIR" ] && [ "$(ls -A $TARGET_DIR)" ]; then
    echo -e "${RED}The target directory $TARGET_DIR already exists and is not empty. Please remove it and try again.${NC}"
    exit 1
fi

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo -e "${RED}Git is not installed. Please install git first (https://git-scm.com/book/en/v2/Getting-Started-Installing-Git).${NC}"
    exit 1
fi

# Check if port 5432 is free
if lsof -Pi :5432 -sTCP:LISTEN -t >/dev/null; then
    echo -e "${RED}Port 5432 for the database is already in use. Please free up the port and try again.${NC}"
    exit 1
fi

# Install Docker if not present and on linux
if ! command -v docker &> /dev/null; then
    if [[ "$OSTYPE" == "linux-gnu" ]]; then
        echo "Installing Docker..."
        curl https://get.docker.com | sh
        if [ "$EUID" -ne 0 ]; then
            echo "Adding user $(whoami) to docker group"
            sudo usermod -aG docker "$(whoami)"
            echo "IMPORTANT: Please re-login (or close and re-connect SSH) for docker to function correctly"
        fi
        # reload the environment to pick up docker
        source ~/.bashrc
    else
        echo -e "${RED}Docker is not installed and cannot automatically be installed. Please install Docker first (https://docs.docker.com/get-docker/).${NC}"
        exit 1
    fi
fi

# Clone the repository
echo "Cloning the SPS Validator repository into $TARGET_DIR..."
git clone --branch "$VERSION" --single-branch https://github.com/TheSPSDAO/SPS-Validator.git "$TARGET_DIR"
cd $TARGET_DIR

# Copy environment file
echo "Creating environment file..."
cp .env-example .env

# Ask if the user wants to use a production prefix or qa prefix
echo "Do you want to use a production prefix or qa prefix?"
echo "1. Production prefix (mainnet)"
echo "2. QA prefix (testnet)"
read -p "Enter your choice (1 or 2): " -n 1 -r choice
case $choice in
    1)
        echo "Using production prefix..."
        replace_env "CUSTOM_JSON_PREFIX" "sm_" .env
        replace_env "CUSTOM_JSON_ID" "sm_sps" .env
        ;;
    2)
        echo "Using QA prefix..."
        replace_env "CUSTOM_JSON_PREFIX" "sl-qavosm_" .env
        replace_env "CUSTOM_JSON_ID" "sl-qavosm_sps" .env
        ;;
    *)
        echo -e "${RED}Invalid prefix choice. Exiting.${NC}"
        exit 1
        ;;
esac

# Ask for the account name. If empty, keep asking
read -p "Enter your the hive account name you will be using as your node account: " -n 1 -r account_name
while [ -z "$account_name" ]; do
    echo -e "${RED}Account name cannot be empty.${NC}"
    read -p "Enter your the hive account name you will be using as your node account: " -n 1 -r account_name
done
replace_env "VALIDATOR_ACCOUNT" "$account_name" .env

# Ask for the posting key. If empty, keep asking
read -p "Enter your the hive posting key for the account that your node will use to broadcast transactions: " -n 1 -r posting_key
while [ -z "$posting_key" ]; do
    echo -e "${RED}Posting key cannot be empty.${NC}"
    read -p "Enter your the hive posting key for the account that your node will use to broadcast transactions: " -n 1 -r posting_key
done
replace_env "VALIDATOR_KEY" "$posting_key" .env

# Ensure validator is not running
echo "Ensuring validator is not running..."
./run.sh stop

# Build the validator
echo "Building the validator..."
./run.sh build

# Start the validator with management UI
echo "Starting the validator with management UI..."
./run.sh start all-silent


echo -e "${GREEN}Installation complete!${NC}"
echo "You can access the validator status at: http://localhost:3333/status"
echo "You can access the management UI at: http://localhost:8888/"
echo -e "${RED}Important:${NC} Don't forget to:"
echo "1. View the logs to ensure your node is catching up (./run.sh logs)"
echo "2. Register your node through the management UI after your node catches up (the logs will say \"blocks to head: 0\")"
echo "3. Stake your licenses if needed (https://splinterlands.com/dashboard/licenses)"
