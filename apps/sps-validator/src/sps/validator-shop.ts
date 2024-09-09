import { inject, singleton } from 'tsyringe';
import { BalanceRepository, LastBlockCache, PriceFeedConsumer, ShopWatch } from '@steem-monsters/splinterlands-validator';
import { ValidatorShop } from './utilities/validator-shop';

@singleton()
export class SpsValidatorShop extends ValidatorShop {
    constructor(
        @inject(LastBlockCache) lastBlockCache: LastBlockCache,
        @inject(BalanceRepository) balanceRepository: BalanceRepository,
        @inject(PriceFeedConsumer) consumer: PriceFeedConsumer,
        @inject(ShopWatch) watcher: ShopWatch,
    ) {
        super(lastBlockCache, balanceRepository, consumer, watcher);
    }
}
