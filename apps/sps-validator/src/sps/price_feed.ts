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
import { PriceFeedWatch } from './features/price_feed';

@singleton()
export class SpsPriceFeed extends RawPriceFeed {
    constructor(
        @inject(PriceHistoryRepository) priceHistoryRepository: PriceHistoryRepository,
        @inject(PriceCalculator) calculator: PriceCalculator,
        @inject(BlockRepository) blockRepository: BlockRepository,
    ) {
        super(priceHistoryRepository, calculator, blockRepository);
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
