import * as utils from '../utils';
import { LogLevel } from '../utils';
import { AsyncQueue, waitForEvent } from './async-queue';
import { HeadBlockObserver } from './head-block-observer';
import { BlockchainMode, Client, SignedBlock } from 'splinterlands-dhive-sl';

export type HiveStreamOptions = {
    replay_batch_size: number;
};
export const HiveStreamOptions: unique symbol = Symbol.for('HiveStreamOptions');

type NumberedSignedBlock = {
    num: number;
    block: SignedBlock;
};

async function streamBlocksIntoQueue(client: Client, queue: AsyncQueue<NumberedSignedBlock>, from: number, observer: HeadBlockObserver): Promise<never> {
    // There's some code in index.ts in the root which is still compliant with hive-interface which causes the "from"
    // block to actually be "from - 1", which I guess works out nicely for our case here as well.
    let lastSuccessfullyFetchedBlockNum = from;

    // TODO: Figure out clean error/shutdown method.
    while (true) {
        if (observer.headBlockNum < lastSuccessfullyFetchedBlockNum) {
            // Do not stream negative amount of blocks (e.g. when we want to stream in the future)
            await waitForEvent(observer, 'updated');
            continue;
        }

        const elementsToStream = Math.min(queue.free, observer.headBlockNum - lastSuccessfullyFetchedBlockNum);
        utils.log(`Streaming ${elementsToStream} blocks into queue`, LogLevel.Debug);

        const promises: Promise<NumberedSignedBlock>[] = new Array(elementsToStream)
            .fill(lastSuccessfullyFetchedBlockNum + 1)
            // Effectively lastSuccessfullyFetchedBlockNum++, but then without modifying the original value.
            .map((x, i) => x + i)
            .map(async (x) => ({ num: x, block: await client.database.getBlock(x) }));

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
        streamBlocksIntoQueue(this.client, queue, from, observer).catch((e) => utils.log(`Block streaming crashed`, e));

        return dequeueGenerator(queue);
    }

    public streamHead(): AsyncGenerator<number, void, unknown> {
        return this.client.blockchain.getBlockNumbers({ mode: this.blockchainMode });
    }

    public currentHead(): Promise<number> {
        return this.client.blockchain.getCurrentBlockNum(this.blockchainMode);
    }
}
