import { Container, Resolver } from './utilities/dependency-injection';
import { SynchronisationConfig } from './sync/type';
import { Primer } from './utilities/primer';
import { EntryOptions } from './utilities/entry-options';
import { validateTables } from './db/tables';
import { Knex } from 'knex';
import { Snapshot } from './utilities/snapshot';
import { HiveStream } from './libs/hive-stream';
import { DelayedSocket } from './socket';
import { BlockProcessor } from './processor';
import { BlockRepository, LastBlockCache, NBlock } from './entities/block';
import { ConditionalApiActivator } from './api/activator';
import { HeadBlockObserver } from './libs/head-block-observer';
import * as utils from './utils';
import { LogLevel } from './utils';
import { coerceToBlockNum } from './utilities/block_num';
import { EventLog } from './entities/event_log';
import { PluginDispatcher } from './libs/plugin';
import { IStop, Stop } from './utilities/stop';
import { getTables } from '@wwwouter/typed-knex';

interface PreflightOpts {
    tablesToSkipValidation: string[];
}

export class EntryPoint<T extends Resolver & Container, S extends SynchronisationConfig> implements IStop {
    // Save recent l2 block hashes in memory so they can be referenced for validation
    // TODO: Re-enable + manage via snapshot?
    public block_hashes: { block_num: number; hash: string }[] = [];
    readonly #stop = new Stop();

    public constructor(
        private readonly primer: Primer,
        private readonly cfg: EntryOptions,
        public readonly knex: Knex,
        public readonly snap: Snapshot<T>,
        public readonly stream: HiveStream,
        private readonly socket: DelayedSocket,
        public readonly processor: BlockProcessor<S>,
        public readonly blockRepository: BlockRepository,
        public readonly lastBlockCache: LastBlockCache,
        public readonly activator: ConditionalApiActivator,
        public readonly pluginDispatcher: PluginDispatcher,
    ) {}

    stop(): void {
        this.#stop.stop();
    }

    get shouldStop() {
        return this.#stop.shouldStop;
    }

    async preflightCheck(opts: PreflightOpts = { tablesToSkipValidation: [] }) {
        await validateTables(this.knex, EntryPoint.getTablesToValidate(opts));

        if (this.cfg.block_processing) {
            await this.primer.prime();
            this.socket.perhapsConnect();
            this.snap.commit();
        }
    }

    private static getTablesToValidate(opts: PreflightOpts) {
        const blockList = new Set(opts.tablesToSkipValidation);
        return getTables()
            .map(({ tableName }) => tableName)
            .filter((table) => !blockList.has(table));
    }

    private async streamBlocks(observer: HeadBlockObserver) {
        if (this.shouldStop) {
            return;
        }
        const lastBlock = await this.loadLastBlock();

        const stream = this.stream.stream(lastBlock?.last_block ?? observer.headBlockNum, observer);
        let round_finish_time = Date.now();

        for await (const entry of stream) {
            const start_time = Date.now();
            const block_num = entry.num;
            const block_data = entry.block;
            this.pluginDispatcher.dispatchBefore(block_num);

            let event_logs: EventLog[] = [];
            let block_hash = '';
            try {
                const prev_block_hash = await this.getBlockHash(block_num - 1);
                utils.log(`Processing block [${block_num}], Head Block: ${observer.headBlockNum}, Blocks to head: ${observer.headBlockNum - block_num}.`);

                const block = new NBlock(block_num, block_data, { l2_block_id: prev_block_hash as string });
                const result = await this.processor.process(block);
                block_hash = result.block_hash;
                event_logs = result.event_logs;

                this.snap.commit();
                // Cache the hashes of the past 20 blocks in memory
                //block_hashes.push({ block_num, hash: block.hash as string });
                //block_hashes = block_hashes.slice(-20);
            } catch (err: any) {
                this.socket.clearDelayed();
                this.snap.rollback();
                utils.log(`Error processing block ${block_num} - ${err.message}`, 1, 'Red');
                utils.log(err.stack, 1);
                throw err;
            }
            this.socket.sendDelayedBulk();

            const processing_time = Date.now() - start_time;
            utils.log(`Processed block ${block_num} in ${processing_time}ms`, LogLevel.Debug);
            utils.log(`Waited ${start_time - round_finish_time}ms for new block.`, LogLevel.Debug);

            this.pluginDispatcher.dispatch(block_num, event_logs, block_hash);

            round_finish_time = Date.now();
            if (this.shouldStop) {
                await stream.return();
                break;
            }
        }
    }

    private async getBlockHash(block_num: number): Promise<string | null> {
        // Check if it is cached
        const cache_hit = this.block_hashes.find((b) => b.block_num === block_num);
        if (cache_hit) {
            return cache_hit.hash;
        }

        const block = await this.blockRepository.getBlockHash(block_num);
        return block ? block.l2_block_id : null;
    }

    private async loadLastBlock(): Promise<{ last_block: number } | null> {
        if (this.cfg.start_block === 'HEAD') {
            utils.log(`Streaming directly from HEAD...`);
            return null;
        }

        const last_seen_block = coerceToBlockNum(await this.blockRepository.getLatestBlockNum());
        const start_block = coerceToBlockNum(this.cfg.start_block);
        if (last_seen_block) {
            utils.log(`Ignoring START_BLOCK, streaming from last processed block: ${last_seen_block}`);
            await this.lastBlockCache.primeCache();
            return { last_block: last_seen_block };
        } else if (start_block) {
            utils.log(`No known last processed block. Streaming from START_BLOCK (${start_block}).`);
            return { last_block: start_block - 1 };
        } else {
            utils.log(`No known last processed block, and START_BLOCK was not a number.`);
            utils.log(`Streaming directly from HEAD...`);
            return null;
        }
    }

    async start() {
        if (this.cfg.block_processing) {
            const currentHead = await this.stream.currentHead();
            const headBlockObserver = new HeadBlockObserver(currentHead);

            this.streamBlocks(headBlockObserver).catch((e) => {
                console.error('Error while streaming blocks', e);
                process.exit(5);
            });

            // TODO: Clean this up.
            (async () => {
                for await (const head of this.stream.streamHead()) {
                    headBlockObserver.headBlockNum = head;
                }
            })().catch((e) => {
                console.error('Error while streaming head numbers', e);
                // Streaming doesn't seem to error ever, which is nice job by the dhive people I guess.
                process.exit(5);
            });
        }
        this.activator.perhapsEnableApi();
    }
}
