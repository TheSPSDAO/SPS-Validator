import {
    BlockRepository,
    PriceCalculator,
    PriceFeedProducer,
    PriceHistoryRepository,
    RawPriceFeed,
    TopPriceFeedWrapper,
    ValidatorRepository,
    ValidatorWatch,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable, singleton } from 'tsyringe';

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
    ) {
        super(source, validatorRepository, watcher);
    }
}
