import {
    BlockRepository,
    EventLog,
    PriceCalculator,
    PriceEntry,
    PriceFeedProducer,
    PriceHistoryRepository,
    RawPriceFeed,
    TopPriceFeedWrapper,
    Trx,
    ValidatorRepository,
    ValidatorWatch,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable, singleton } from 'tsyringe';
import { PriceFeedWatch } from '.';
import { TransitionManager } from '../transition';

@singleton()
export class SpsPriceFeed extends RawPriceFeed {
    constructor(
        @inject(PriceHistoryRepository) priceHistoryRepository: PriceHistoryRepository,
        @inject(PriceCalculator) calculator: PriceCalculator,
        @inject(BlockRepository) blockRepository: BlockRepository,
        @inject(ValidatorRepository) private readonly validatorRepository: ValidatorRepository,
        @inject(ValidatorWatch) private readonly validatorWatch: ValidatorWatch,
        @inject(TransitionManager) private readonly transitionManager: TransitionManager,
    ) {
        super(priceHistoryRepository, calculator, blockRepository);
    }

    override async getPriceAtPoint(token: string, block_time: Date, trx?: Trx, block_num?: number): Promise<number | undefined> {
        await this.fillStore(trx);
        const topValidators = await this.getTopValidatorsIfTransitioned(block_num, trx);
        const entries = this.entriesForTransitionAwareCalculation(token, block_time, topValidators);
        if (entries.length) {
            return this.calculator.calculate(block_time, entries);
        }
        return;
    }

    override async getPricesAtPoint(tokens: string[], block_time: Date, trx?: Trx, block_num?: number): Promise<Array<{ token: string; price: number | undefined }>> {
        await this.fillStore(trx);
        const topValidators = await this.getTopValidatorsIfTransitioned(block_num, trx);
        const results: Array<{ token: string; price: number | undefined }> = [];
        for (const token of tokens) {
            const entries = this.entriesForTransitionAwareCalculation(token, block_time, topValidators);
            if (entries.length) {
                results.push({ token, price: this.calculator.calculate(block_time, entries) });
            } else {
                results.push({ token, price: undefined });
            }
        }
        return results;
    }

    private entriesForTransitionAwareCalculation(token: string, blockTime: Date, topValidators: Set<string> | null | undefined): PriceEntry[] {
        const relevant = this.value.get(token);
        if (!relevant?.length) {
            return [];
        }

        if (topValidators === undefined) {
            return [...relevant];
        }

        return this.entriesForCalculationFromList(topValidators === null ? relevant : relevant.filter((entry) => topValidators.has(entry.validator)), blockTime);
    }

    private async getTopValidatorsIfTransitioned(block_num?: number, trx?: Trx): Promise<Set<string> | null | undefined> {
        const effectiveBlockNum = block_num ?? (await this.getEvaluationBlockNum(trx));
        if (effectiveBlockNum === undefined || !this.transitionManager.isTransitioned('price_feed_consensus_update', effectiveBlockNum)) {
            return undefined;
        }
        return this.getTopValidatorSet(trx);
    }

    private async getEvaluationBlockNum(trx?: Trx): Promise<number | undefined> {
        const latestBlockNum = await this.blockRepository.getLatestBlockNum(trx);
        return latestBlockNum === null ? undefined : latestBlockNum;
    }

    private async getTopValidatorSet(trx?: Trx): Promise<Set<string> | null> {
        const limit = this.validatorWatch.validator?.num_top_validators;
        if (!limit || limit <= 0) {
            return null;
        }

        const { validators } = await this.validatorRepository.getValidators({ limit, is_active: true }, trx);
        return new Set(validators.map((validator) => validator.account_name));
    }
}

@injectable()
export class SpsTopPriceFeedWrapper extends TopPriceFeedWrapper {
    constructor(
        @inject(PriceFeedProducer) source: PriceFeedProducer,
        @inject(ValidatorRepository) validatorRepository: ValidatorRepository,
        @inject(ValidatorWatch) watcher: ValidatorWatch,
        @inject(PriceFeedWatch) private readonly priceFeedWatch: PriceFeedWatch,
        @inject(PriceHistoryRepository) private readonly priceHistoryRepository: PriceHistoryRepository,
    ) {
        super(source, validatorRepository, watcher);
    }

    override async addPriceEntry(pe: PriceEntry, trx?: Trx): Promise<EventLog[]> {
        if (!this.priceFeedWatch.price_feed) {
            return [];
        }
        const lastEntry = await this.priceHistoryRepository.getLastPriceEntry(pe.validator, pe.token, trx);
        if (lastEntry && lastEntry.block_num + this.priceFeedWatch.price_feed.interval_blocks > pe.block_num) {
            return [];
        }
        return super.addPriceEntry(pe, trx);
    }
}
