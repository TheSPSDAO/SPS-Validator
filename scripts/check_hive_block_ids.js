const { existsSync, writeFileSync, readFileSync } = require('node:fs');
const { Client } = require('splinterlands-dhive-sl');

const validatorNodeUrl = 'https://splinterlands-validator-api.splinterlands.com';
let startBlock = 101387261;
if (process.argv.length > 2) {
    startBlock = parseInt(process.argv[2], 10);
    if (Number.isNaN(startBlock)) {
        console.error('Invalid start block number');
        process.exit(1);
    }
}

const client = new Client({
    nodes: ['https://api.hive.blog', 'https://api.openhive.network', 'https://anyx.io', 'https://api.deathwing.me', 'https://techcoderx.com'],
});

console.log(`Checking hive block ids starting from block number ${startBlock}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const retry = async (fn, retries = 100, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) {
                throw error;
            }
            console.warn(`Attempt ${i + 1} failed. Retrying in ${delay}ms...`);
            await sleep(delay);
        }
    }
};
const checkFork = async () => {
    let blockNum = startBlock;
    if (existsSync('last_checked_block.txt')) {
        const lastCheckedBlock = parseInt(readFileSync('last_checked_block.txt', 'utf-8'), 10);
        if (!Number.isNaN(lastCheckedBlock) && lastCheckedBlock > blockNum) {
            blockNum = lastCheckedBlock + 1;
        }
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        try {
            const [validatorResult, hiveResult] = await Promise.all([
                retry(async () => {
                    const response = await fetch(`${validatorNodeUrl}/block/${blockNum}`);
                    if (!response.ok) {
                        throw new Error(`Failed to fetch block ${blockNum} from validator node`);
                    }
                    return response.json();
                }),
                retry(() => client.database.call('get_block', [blockNum])),
            ]);

            // check if validatorResult.block_id matches hiveResult.block_id
            if (validatorResult.block_id !== hiveResult.block_id) {
                console.error(`Fork detected at block ${blockNum}! Validator block ID: ${validatorResult.block_id}, Hive block ID: ${hiveResult.block_id}`);
                // append the block number and block_id to a file called fork_blocks.csv
                const csvLine = `${blockNum},${validatorResult.block_id},${hiveResult.block_id}\n`;
                if (!existsSync('fork_blocks.csv')) {
                    writeFileSync('fork_blocks.csv', 'block_num,validator_block_id,hive_block_id\n', 'utf-8');
                }
                writeFileSync('fork_blocks.csv', csvLine, { flag: 'a', encoding: 'utf-8' });
            } else {
                console.log(`Block ${blockNum} is consistent. Block ID: ${validatorResult.block_id}`);
            }

            writeFileSync('last_checked_block.txt', blockNum.toString(), 'utf-8');
            blockNum++;
        } catch (error) {
            console.error(`Error checking block ${blockNum}:`, error);
            console.log('Retrying in 5 seconds...');
            await sleep(5000);
        }
    }
};

checkFork();
