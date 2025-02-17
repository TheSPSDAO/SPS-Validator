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
    getPriceAtPoint(token: string, block_time: Date, trx?: Trx): Promise<number | undefined>;
    /**
     * @throws PriceFeedError
     */
    getPricesAtPoint(token: string[], block_time: Date, trx?: Trx): Promise<Array<{ token: string; price: number | undefined }>>;
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

    constructor(private readonly priceHistoryRepository: PriceHistoryRepository, private readonly calculator: PriceCalculator, private readonly blockRepository: BlockRepository) {
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

    async getPriceAtPoint(token: string, block_time: Date, trx?: Trx): Promise<number | undefined> {
        await this.fillStore(trx);
        const relevant = this.value.get(token);
        if (relevant?.length) {
            return this.calculator.calculate(block_time, relevant);
        } else {
            return;
        }
    }

    async getPricesAtPoint(tokens: string[], block_time: Date, trx?: Trx) {
        await this.fillStore(trx);
        const results: Array<{ token: string; price: number | undefined }> = [];
        for (const token of tokens) {
            const relevant = this.value.get(token);
            if (relevant?.length) {
                results.push({ token, price: this.calculator.calculate(block_time, relevant) });
            } else {
                results.push({ token, price: undefined });
            }
        }
        return results;
    }

    private async fillStore(trx?: Trx) {
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
        } else if (this.watcher.validator.paused_until_block > 0) {
            return this.watcher.validator.paused_until_block < pe.block_num;
        } else {
            return this.watcher.validator.reward_start_block <= pe.block_num;
        }
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
