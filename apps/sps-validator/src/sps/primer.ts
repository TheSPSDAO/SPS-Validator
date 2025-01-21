import { inject, singleton } from 'tsyringe';
import { SpsConfigLoader } from './config';
import { Bookkeeping, LastBlockCache, Prime, Primer, RawPriceFeed } from '@steem-monsters/splinterlands-validator';
import { ValidatorShop } from './utilities/validator-shop';
import { ValidatorCheckInPlugin } from './features/validator/license-plugin';

@singleton()
export class SpsPrimer extends Primer {
    constructor(
        @inject(RawPriceFeed) feed: Prime,
        @inject(LastBlockCache) lastBlockCache: Prime,
        @inject(SpsConfigLoader) configLoader: Prime,
        @inject(ValidatorShop) shop: Prime,
        @inject(Bookkeeping) bookkeeping: Prime,
        @inject(ValidatorCheckInPlugin) checkInPlugin: Prime,
    ) {
        super(feed, lastBlockCache, configLoader, shop, bookkeeping, checkInPlugin);
    }
}
