import { ValidatorWatch } from '../config';
import { ValidatorRepository } from '../entities/validator/validator';
import { EventLog, EventTypes } from '../entities/event_log';
import { Cache } from './cache';
import { PriceEntry, PriceHistoryRepository } from '../entities/tokens/price_history';
import { Trx } from '../db/tables';
import { Cloneable, Prime } from './traits';
import { BlockRepository } from '../entities/block';

export interface PriceFeedProducer {
    addPriceEntry(pe: PriceEntry, trx?: Trx): Promise<EventLog[]>;
}
export const PriceFeedProducer: unique symbol = Symbol.for('PriceFeedProducer');

export class PriceFeedError extends Error {}

export interface PriceFeedConsumer {
    /**
     * @throws PriceFeedError
     */
    getPriceAtPoint(token: string, block_time: Date, trx?: Trx, block_num?: number): Promise<number | undefined>;
    /**
     * @throws PriceFeedError
     */
    getPricesAtPoint(token: string[], block_time: Date, trx?: Trx, block_num?: number): Promise<Array<{ token: string; price: number | undefined }>>;
}
export const PriceFeedConsumer: unique symbol = Symbol.for('PriceFeedConsumer');

export interface PriceCalculator {
    /**
     * @param block_time
     * @param entries: Should be sorted in reverse chronological order. Should also only refer to one kind of token.
     * @throws PriceFeedError
     */
    calculate(block_time: Date, entries: PriceEntry[]): number;
}
export const PriceCalculator: unique symbol = Symbol.for('PriceCalculator');

export class MedianPriceCalculator implements PriceCalculator {
    calculate(block_time: Date, entries: PriceEntry[]): number {
        if (entries.length === 0) {
            throw new PriceFeedError(`Need at least one matching price entry`);
        } else {
            const token = entries[0].token;
            if (entries.some((e) => e.token !== token)) {
                throw new Error(`Cannot calculate prices for multiple tokens at once`);
            }

            const prices = entries.map((e) => e.token_price).sort((a, b) => a - b);
            if (prices.length % 2 === 0) {
                return (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2;
            } else {
                return prices[Math.floor(prices.length / 2)];
            }
        }
    }
}

export class RawPriceFeed extends Cache<Map<string, PriceEntry[]>, PriceEntry> implements PriceFeedConsumer, PriceFeedProducer, Cloneable<RawPriceFeed>, Prime {
    private static readonly FRESHNESS_WINDOW_MS = 12 * 60 * 60 * 1000;
    private static readonly MIN_FRESH_FEEDS = 7;
    private static readonly MIN_OUTLIER_FILTER_SAMPLE_SIZE = 5;
    private static readonly MAD_THRESHOLD = 3.5;
    private static readonly MAD_ZERO_FALLBACK_RELATIVE_THRESHOLD = 0.2;

    #lock = false;
    private acquire() {
        if (this.#lock) {
            return false;
        }
        this.#lock = true;
        return true;
    }

    private release() {
        this.#lock = false;
    }

    constructor(
        protected readonly priceHistoryRepository: PriceHistoryRepository,
        protected readonly calculator: PriceCalculator,
        protected readonly blockRepository: BlockRepository,
    ) {
        super(new Map());
    }

    clone(): RawPriceFeed {
        return new RawPriceFeed(this.priceHistoryRepository, this.calculator, this.blockRepository);
    }

    async prime(trx?: Trx) {
        this.clear();
        await this.fillStore(trx);
    }

    async addPriceEntry(pe: PriceEntry, trx?: Trx): Promise<EventLog[]> {
        const result = await this.priceHistoryRepository.upsert(pe, trx);
        if (result) {
            this.clear();
            await this.fillStore(trx);
            return [new EventLog(EventTypes.UPSERT, { table: 'price_history' }, result)];
        } else {
            return [];
        }
    }

    async getPriceAtPoint(token: string, block_time: Date, trx?: Trx, _block_num?: number): Promise<number | undefined> {
        await this.fillStore(trx);
        const relevant = this.entriesForCalculation(token, block_time);
        if (relevant?.length) {
            return this.calculator.calculate(block_time, relevant);
        } else {
            return;
        }
    }

    async getPricesAtPoint(tokens: string[], block_time: Date, trx?: Trx, _block_num?: number) {
        await this.fillStore(trx);
        const results: Array<{ token: string; price: number | undefined }> = [];
        for (const token of tokens) {
            const relevant = this.entriesForCalculation(token, block_time);
            if (relevant?.length) {
                results.push({ token, price: this.calculator.calculate(block_time, relevant) });
            } else {
                results.push({ token, price: undefined });
            }
        }
        return results;
    }

    protected async fillStore(trx?: Trx) {
        if (!this.canUpdate || !this.acquire()) {
            return;
        }

        try {
            const blockNum = await this.blockRepository.getLatestBlockNum(trx);

            if (blockNum === null) {
                return;
            }

            const lastBlock = await this.blockRepository.getByBlockNum(blockNum, trx);

            if (lastBlock === null) {
                return;
            }

            // Copy date (as we're going to manipulate it)
            const since = new Date(lastBlock.block_time);
            // Ignore all db entries from before one month ago, as those are unlikely to be relevant.
            since.setMonth(since.getMonth() - 1);
            const newState = new Map();
            for (const [token, entry] of Object.entries(await this.priceHistoryRepository.groupedHistory(since, trx))) {
                newState.set(token, entry);
            }
            this.reload(newState);
        } finally {
            this.release();
        }
    }

    protected entriesForCalculation(token: string, blockTime: Date): PriceEntry[] {
        return this.entriesForCalculationFromList(this.value.get(token), blockTime);
    }

    protected entriesForCalculationFromList(relevant: readonly PriceEntry[] | undefined, blockTime: Date): PriceEntry[] {
        if (!relevant?.length) {
            return [];
        }

        const freshCutoff = blockTime.getTime() - RawPriceFeed.FRESHNESS_WINDOW_MS;
        const freshEntries = relevant.filter((entry) => entry.block_time.getTime() >= freshCutoff);
        const entriesToUse = freshEntries.length >= RawPriceFeed.MIN_FRESH_FEEDS ? freshEntries : relevant;
        return this.filterOutliers(entriesToUse);
    }

    private filterOutliers(entries: readonly PriceEntry[]): PriceEntry[] {
        if (entries.length < RawPriceFeed.MIN_OUTLIER_FILTER_SAMPLE_SIZE) {
            return [...entries];
        }

        const prices = entries.map((entry) => entry.token_price).sort((a, b) => a - b);
        const medianPrice = this.median(prices);
        const deviations = entries.map((entry) => Math.abs(entry.token_price - medianPrice)).sort((a, b) => a - b);
        const mad = this.median(deviations);

        if (mad === 0) {
            const relativeThreshold = Math.abs(medianPrice) * RawPriceFeed.MAD_ZERO_FALLBACK_RELATIVE_THRESHOLD;
            const filtered = entries.filter((entry) => Math.abs(entry.token_price - medianPrice) <= relativeThreshold);
            return filtered.length > 0 ? filtered : [...entries];
        }

        const scaledMad = 1.4826 * mad;
        const filtered = entries.filter((entry) => Math.abs(entry.token_price - medianPrice) / scaledMad <= RawPriceFeed.MAD_THRESHOLD);
        return filtered.length > 0 ? filtered : [...entries];
    }

    private median(sortedValues: readonly number[]): number {
        const mid = Math.floor(sortedValues.length / 2);
        if (sortedValues.length % 2 === 0) {
            return (sortedValues[mid - 1] + sortedValues[mid]) / 2;
        }
        return sortedValues[mid];
    }

    // TODO: if we want to update individual price entries in the future.
    protected updateImpl(currentState: Map<string, PriceEntry[]>, data: PriceEntry): Map<string, PriceEntry[]> {
        const token = data.token;
        if (!currentState.has(token)) {
            currentState.set(token, [data]);
            return currentState;
        }
        const list = currentState.get(token)!;
        const priceEntryIndex = list.findIndex((pe) => pe.validator === data.validator);
        if (priceEntryIndex >= 0) {
            list[priceEntryIndex] = data;
        } else {
            list.push(data);
        }
        currentState.set(token, list);
        return currentState;
    }

    protected reloadImpl(currentState: Map<string, PriceEntry[]>, newState: Map<string, PriceEntry[]>): Map<string, PriceEntry[]> {
        return new Map(newState);
    }

    protected clearImpl(): Map<string, PriceEntry[]> {
        return new Map();
    }

    public get canUpdate(): boolean {
        return this.size === 0;
    }

    public get size(): number {
        return this.value.size;
    }
}

export class TopPriceFeedWrapper implements PriceFeedProducer {
    constructor(private readonly source: PriceFeedProducer, private readonly validatorRepository: ValidatorRepository, private readonly watcher: ValidatorWatch) {}

    async addPriceEntry(pe: PriceEntry, trx?: Trx): Promise<EventLog[]> {
        if (!this.switchedOver(pe)) {
            return this.source.addPriceEntry(pe, trx);
        } else {
            const top = await this.getTopValidators(trx);
            if (top.some((ve) => ve.account_name === pe.validator)) {
                return this.source.addPriceEntry(pe, trx);
            } else {
                return [];
            }
        }
    }

    private switchedOver(pe: PriceEntry) {
        if (!this.watcher.validator) {
            return false;
        }
        const startBlock = Math.max(this.watcher.validator.reward_start_block, this.watcher.validator.paused_until_block);
        return pe.block_num >= startBlock;
    }

    private async getTopValidators(trx?: Trx) {
        const limit = this.watcher.validator?.num_top_validators;
        if (limit) {
            const { validators } = await this.validatorRepository.getValidators({ limit, is_active: true }, trx);
            return validators;
        } else {
            return [];
        }
    }
}
