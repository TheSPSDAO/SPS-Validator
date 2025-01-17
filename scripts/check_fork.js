const nodeUrls = ['http://localhost:3333', 'http://splinterlands-validator-api.validator.qa.splinterlands.com'];
let startBlock = 92474575;
if (process.argv.length > 2) {
    startBlock = parseInt(process.argv[2], 10);
    if (Number.isNaN(startBlock)) {
        console.error('Invalid start block number');
        process.exit(1);
    }
}

console.log(`Checking fork starting from block number ${startBlock}`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const checkFork = async () => {
    let blockNum = startBlock;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const promises = nodeUrls.map(async (url) => {
            const txEndpoint = `${url}/transactions/${blockNum}`;
            const blocksEndpoint = `${url}/block/${blockNum}`;
            try {
                const txResponse = await fetch(txEndpoint);
                if (!txResponse.ok) {
                    return {
                        txEndpoint,
                        blocksEndpoint,
                        txStatus: txResponse.status,
                        success: false,
                    };
                }
                const txData = await txResponse.json();
                const blocksResponse = await fetch(blocksEndpoint);
                if (!blocksResponse.ok) {
                    return {
                        txEndpoint,
                        blocksEndpoint,
                        txStatus: txResponse.status,
                        blocksStatus: blocksResponse.status,
                        success: false,
                    };
                }
                const blocksData = await blocksResponse.json();
                return {
                    txEndpoint,
                    blocksEndpoint,
                    txStatus: txResponse.status,
                    txData: txData.sort((a, b) => a.id.localeCompare(b.id)), // todo: update api to return sorted transactions
                    blocksStatus: blocksResponse.status,
                    blocksData: blocksData,
                    success: true,
                };
            } catch (error) {
                return {
                    txEndpoint,
                    blocksEndpoint,
                    success: false,
                    txStatus: error.message,
                    blocksStatus: error.message,
                };
            }
        });

        const results = await Promise.all(promises);
        const rejected = results.filter((result) => !result.success);
        if (rejected.length > 0) {
            // not processed yet
            const all404Errors = rejected.every((result) => result.txStatus === 404);
            if (all404Errors) {
                await sleep(3000);
                continue;
            }
            const errors = rejected.map((result) => `${result.txEndpoint}: ${result.txStatus} - ${result.blocksEndpoint}: ${result.blocksStatus}`).join('\n');
            console.error(`Error fetching transactions or blocks\n${errors}`);
            process.exit(1);
        }

        const [firstTxs, ...restTxs] = results;
        const firstTxData = JSON.stringify(firstTxs.txData);
        const allTxEqual = restTxs.every((result) => JSON.stringify(result.txData) === firstTxData);
        if (!allTxEqual) {
            const description = results.map((result) => `${result.txEndpoint}:\n ${JSON.stringify(result.txData, null, 2)}`).join('\n\n');
            console.error(`Different transactions at block number ${blockNum}\n${description}`);
            process.exit(1);
        }

        const [firstBlock, ...restBlocks] = results;
        const firstBlockData = JSON.stringify(firstBlock.blocksData);
        const allBlocksEqual = restBlocks.every((result) => JSON.stringify(result.blocksData) === firstBlockData);
        if (!allBlocksEqual) {
            const description = results.map((result) => `${result.blocksEndpoint}:\n ${JSON.stringify(result.blocksData, null, 2)}`).join('\n\n');
            console.error(`Different blocks at block number ${blockNum}\n${description}`);
            process.exit(1);
        }

        console.log(`Block number ${blockNum} is consistent`);
        blockNum++;
    }
};

checkFork();
