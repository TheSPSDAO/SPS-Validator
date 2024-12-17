import presale from './license_tranches/presale.json';
import tranche1 from './license_tranches/tranche_1.json';
import tranche2 from './license_tranches/tranche_2.json';
import tranche3 from './license_tranches/tranche_3.json';
import tranche4 from './license_tranches/tranche_4.json';
import tranche5 from './license_tranches/tranche_5.json';
import tranche6 from './license_tranches/tranche_6.json';
import tranche7 from './license_tranches/tranche_7.json';
import niceSale from './bonus.json';
import { inject, singleton } from 'tsyringe';
import { BalanceRepository, LastBlockCache, PriceFeedConsumer, Shop, ShopWatch, Trx } from '@steem-monsters/splinterlands-validator';
import { ValidatorShop } from '../../sps/utilities/validator-shop';

@singleton()
export class HardcodedValidatorShop extends ValidatorShop {
    constructor(
        @inject(LastBlockCache) lastBlockCache: LastBlockCache,
        @inject(BalanceRepository) balanceRepository: BalanceRepository,
        @inject(PriceFeedConsumer) consumer: PriceFeedConsumer,
        @inject(ShopWatch) watcher: ShopWatch,
    ) {
        super(lastBlockCache, balanceRepository, consumer, watcher);
        this.reset();
    }

    private reset() {
        this.clear();
        const presale_ = Shop.from(presale);
        const tranches = [tranche1, tranche2, tranche3, tranche4, tranche5, tranche6, tranche7].map(Shop.from);
        this.registerSale('validator_tranche_info', presale_, ...tranches);
        this.registerSale('nice_sale', Shop.from(niceSale));
    }
    override async prime(_?: Trx) {
        this.reset();
    }
}
