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

@singleton()
export class SpsPriceFeed extends RawPriceFeed {
    constructor(
        @inject(PriceHistoryRepository) priceHistoryRepository: PriceHistoryRepository,
        @inject(PriceCalculator) calculator: PriceCalculator,
        @inject(BlockRepository) blockRepository: BlockRepository,
        @inject(ValidatorRepository) private readonly validatorRepository: ValidatorRepository,
        @inject(ValidatorWatch) private readonly validatorWatch: ValidatorWatch,
    ) {
        super(priceHistoryRepository, calculator, blockRepository);
    }

    override async getPriceAtPoint(token: string, block_time: Date, trx?: Trx): Promise<number | undefined> {
        await this.fillStore(trx);
        const relevant = await this.getTopValidatorEntries(token, trx);
        const entries = this.entriesForCalculationFromList(relevant, block_time);
        if (entries.length) {
            return this.calculator.calculate(block_time, entries);
        }
        return;
    }

    override async getPricesAtPoint(tokens: string[], block_time: Date, trx?: Trx): Promise<Array<{ token: string; price: number | undefined }>> {
        await this.fillStore(trx);
        const results: Array<{ token: string; price: number | undefined }> = [];
        for (const token of tokens) {
            const relevant = await this.getTopValidatorEntries(token, trx);
            const entries = this.entriesForCalculationFromList(relevant, block_time);
            if (entries.length) {
                results.push({ token, price: this.calculator.calculate(block_time, entries) });
            } else {
                results.push({ token, price: undefined });
            }
        }
        return results;
    }

    private async getTopValidatorEntries(token: string, trx?: Trx): Promise<PriceEntry[]> {
        const relevant = this.value.get(token);
        if (!relevant?.length) {
            return [];
        }

        const topValidators = await this.getTopValidatorSet(trx);
        if (topValidators === null) {
            return [...relevant];
        }

        return relevant.filter((entry) => topValidators.has(entry.validator));
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
