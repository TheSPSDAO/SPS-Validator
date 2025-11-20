import * as utils from '../utils';
import { LogLevel } from '../utils';
import { AsyncQueue, waitForEvent } from './async-queue';
import { HeadBlockObserver } from './head-block-observer';
import { BlockchainMode, Client, SignedBlock } from 'splinterlands-dhive-sl';

export type HiveStreamOptions = {
    replay_batch_size: number;
    stream_safe_mode: boolean;
    stream_safe_mode_retry_attempts: number;
    stream_safe_mode_retry_delay_ms: number;
};
export const HiveStreamOptions: unique symbol = Symbol.for('HiveStreamOptions');

type NumberedSignedBlock = {
    num: number;
    block: SignedBlock;
};

async function streamBlocksIntoQueue(
    options: HiveStreamOptions,
    client: Client,
    queue: AsyncQueue<NumberedSignedBlock>,
    from: number,
    observer: HeadBlockObserver,
): Promise<never> {
    // There's some code in index.ts in the root which is still compliant with hive-interface which causes the "from"
    // block to actually be "from - 1", which I guess works out nicely for our case here as well.
    let lastSuccessfullyFetchedBlockNum = from;

    let consesusCount = 1;
    let clients = [client];
    const clientNodes = client.options.nodes;
    if (Array.isArray(clientNodes) && clientNodes.length >= 3 && options.stream_safe_mode) {
        utils.log(`Safe mode enabled, using multiple nodes for streaming: ${clientNodes.join(', ')}`, LogLevel.Info);
        clients = clientNodes.map((node) => new Client({ ...client.options, nodes: [node] }));
        // we want at least a ratio of 2/3 of the nodes to agree on a block before we consider it valid.
        consesusCount = Math.ceil((clients.length * 2) / 3);
        utils.log(`Safe mode enabled, using consensus count of ${consesusCount} out of ${clients.length} nodes`, LogLevel.Info);
    } else if (options.stream_safe_mode) {
        utils.log(`Safe mode enabled, but not enough nodes provided for streaming. Safe mode requires at least 3 nodes to be effective.`, LogLevel.Warning);
    }

    // TODO: Figure out clean error/shutdown method.
    while (true) {
        let headBlockNum = observer.headBlockNum;
        if (client.options.stream?.blocksBehindHead) {
            headBlockNum = Math.max(0, headBlockNum - client.options.stream.blocksBehindHead);
        }
        if (headBlockNum < lastSuccessfullyFetchedBlockNum) {
            // Do not stream negative amount of blocks (e.g. when we want to stream in the future)
            await waitForEvent(observer, 'updated');
            continue;
        }

        const elementsToStream = Math.min(queue.free, headBlockNum - lastSuccessfullyFetchedBlockNum);
        utils.log(`Streaming ${elementsToStream} blocks into queue`, LogLevel.Debug);

        const promises: Promise<NumberedSignedBlock>[] = new Array<number>(elementsToStream)
            .fill(lastSuccessfullyFetchedBlockNum + 1)
            // Effectively lastSuccessfullyFetchedBlockNum++, but then without modifying the original value.
            .map((x, i) => x + i)
            .map(async (x) => {
                const blockResults = await Promise.all(
                    clients.map(async (c) => {
                        for (let attempt = 0; attempt < options.stream_safe_mode_retry_attempts; attempt++) {
                            try {
                                return await c.database.getBlock(x);
                            } catch (e) {
                                const node = Array.isArray(c.options.nodes) ? c.options.nodes[0] : c.options.nodes;
                                utils.log(`Failed to fetch block ${x} from node ${node} on attempt ${attempt + 1}: ${e}`, LogLevel.Warning);
                                if (attempt === options.stream_safe_mode_retry_attempts - 1) {
                                    return null;
                                }
                                await new Promise((resolve) => setTimeout(resolve, options.stream_safe_mode_retry_delay_ms));
                            }
                        }
                        return null;
                    }),
                );
                const validBlocks = blockResults.filter((b) => b !== null);
                // first make sure we have enough non-null blocks.
                if (validBlocks.length < consesusCount) {
                    utils.log(
                        `Failed to fetch block ${x} from ${clients.length} nodes, only ${validBlocks.length} nodes returned a block. Required ${consesusCount} for consensus. Retrying...`,
                        LogLevel.Warning,
                    );
                    throw new Error(`Failed to fetch block ${x} from enough nodes`);
                }
                // Then make sure we have one block_id that has enough consensus.
                const blockIdCounts = validBlocks.reduce((acc, block) => {
                    acc[block.block_id] = (acc[block.block_id] || 0) + 1;
                    return acc;
                }, {} as Record<string, number>);
                const consensusBlockId = Object.entries(blockIdCounts).find(([_, count]) => count >= consesusCount)?.[0];
                if (!consensusBlockId) {
                    utils.log(
                        `Failed to fetch block ${x} from ${clients.length} nodes, no block_id had enough consensus. Block IDs: ${Object.keys(blockIdCounts).join(
                            ', ',
                        )}. Retrying...`,
                        LogLevel.Warning,
                    );
                    throw new Error(`Failed to fetch block ${x} with enough consensus`);
                }
                const consensusBlock = validBlocks.find((b) => b.block_id === consensusBlockId)!;
                return { num: x, block: consensusBlock };
            });

        try {
            for await (const result of promises) {
                if (result.block === null) {
                    // Possible if we fetched a block from a node that has not caught up yet?
                    utils.log(`Contents of block ${result.num} is null`, LogLevel.Warning);
                    break;
                }

                lastSuccessfullyFetchedBlockNum = result.num;
                await queue.enqueue(result);
            }
        } catch (e) {
            continue;
        }

        if (queue.free === 0) {
            await waitForEvent(queue, 'dequeued');
        }

        if (observer.headBlockNum === lastSuccessfullyFetchedBlockNum) {
            await waitForEvent(observer, 'updated');
        }
    }
}

// TODO: Rethink this in the future, doesn't work great when we stop producing blocks due to an error somewhere.
async function* dequeueGenerator<T>(queue: AsyncQueue<T>): AsyncGenerator<T, void, undefined> {
    while (true) {
        yield await queue.dequeue();
    }
}

/**
 * A hive stream, attempts to fetch blocks as fast as we can process them.
 */
export class HiveStream {
    public readonly blockchainMode: BlockchainMode;

    public constructor(private readonly client: Client, private readonly options: HiveStreamOptions) {
        this.blockchainMode = client.options.stream?.mode ?? 'irreversible';
    }

    public stream(from: number, observer: HeadBlockObserver): AsyncGenerator<NumberedSignedBlock, void, undefined> {
        const queue = new AsyncQueue<NumberedSignedBlock>(this.options.replay_batch_size);

        streamBlocksIntoQueue(this.options, this.client, queue, from, observer).catch((e) => utils.log(`Block streaming crashed`, e));

        return dequeueGenerator(queue);
    }

    public streamHead(): AsyncGenerator<number, void, unknown> {
        return this.client.blockchain.getBlockNumbers({ mode: this.blockchainMode });
    }

    public currentHead(): Promise<number> {
        return this.client.blockchain.getCurrentBlockNum(this.blockchainMode);
    }
}
