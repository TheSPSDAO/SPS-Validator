const nodeUrls = ['http://localhost:3333', 'http://splinterlands-validator.validator.qa.splinterlands.com'];
const startBlock = 92294799;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const checkFork = async () => {
    let blockNum = startBlock;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const transactionsEndpoint = `/transactions/${blockNum}`;
        const promises = nodeUrls.map(async (url) => {
            try {
                const endpoint = `${url}${transactionsEndpoint}`;
                const response = await fetch(endpoint);
                if (!response.ok) {
                    return {
                        url: endpoint,
                        success: false,
                        status: response.status,
                    };
                }
                const data = await response.json();
                return {
                    url: endpoint,
                    success: true,
                    status: response.status,
                    data: data.sort((a, b) => a.id.localeCompare(b.id)), // todo: update api to return sorted transactions
                };
            } catch (error) {
                return {
                    url,
                    success: false,
                    status: error.message,
                };
            }
        });

        const results = await Promise.all(promises);
        const rejected = results.filter((result) => !result.success);
        if (rejected.length > 0) {
            // not processed yet
            const all404Errors = rejected.every((result) => result.status === 404);
            if (all404Errors) {
                await sleep(3000);
                continue;
            }
            const errors = rejected.map((result) => `${result.url}: ${result.status}`).join('\n');
            console.error(`Error fetching transactions\n${errors}`);
            process.exit(1);
        }

        const [first, ...rest] = results;
        const firstData = JSON.stringify(first.data);
        const allEqual = rest.every((result) => JSON.stringify(result.data) === firstData);
        if (!allEqual) {
            const description = results.map((result) => `${result.url}:\n ${JSON.stringify(result.data, null, 2)}`).join('\n\n');
            console.error(`Different transactions at block number ${blockNum}\n${description}`);
            process.exit(1);
        }

        console.log(`Block number ${blockNum} is consistent`);
        blockNum++;
    }
};

checkFork();
