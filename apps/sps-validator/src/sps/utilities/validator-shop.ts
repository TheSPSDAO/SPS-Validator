import { BalanceRepository, LastBlockCache, log, LogLevel, PriceFeedConsumer, Prime, Shop, ShopConfig, ShopWatch, Trx } from '@steem-monsters/splinterlands-validator';

class Clock {
    constructor(private readonly lastBlockCache: LastBlockCache) {}

    current() {
        return this.lastBlockCache.value?.block_time;
    }
}

export class ValidatorShop extends Shop<Trx> implements Prime {
    constructor(lastBlockCache: LastBlockCache, balanceRepository: BalanceRepository, consumer: PriceFeedConsumer, private readonly watcher: ShopWatch) {
        super(new Clock(lastBlockCache), balanceRepository, consumer);
    }

    private static readonly UPDATE_SHOP: unique symbol = Symbol('UpdateShop');

    private register(config?: ShopConfig) {
        this.clear();
        if (config) {
            // TODO: This really needs to go, but legacy :D
            // Don't ever use tranch system anymore!
            const {
                validator_tranch_0,
                validator_tranch_1,
                validator_tranch_2,
                validator_tranch_3,
                validator_tranch_4,
                validator_tranch_5,
                validator_tranch_6,
                validator_tranch_7,
                ...dynamic_config
            } = config;
            const presale = Shop.from(validator_tranch_0);
            const sales = [validator_tranch_1, validator_tranch_2, validator_tranch_3, validator_tranch_4, validator_tranch_5, validator_tranch_6, validator_tranch_7].map(
                Shop.from,
            );
            this.registerSale('validator_tranche_info', presale, ...sales);

            for (const c in dynamic_config) {
                try {
                    this.registerSale(c, Shop.from(dynamic_config[c]));
                } catch (e) {
                    log(`Could not load configuration ${c} into the shop`, LogLevel.Warning);
                }
            }
        } else {
            log(`Could not correctly configure validator shop with current configuration!`, LogLevel.Warning);
        }
    }

    async prime(_trx?: Trx) {
        this.watcher.removeShopWatcher(ValidatorShop.UPDATE_SHOP);
        this.watcher.addShopWatcher(ValidatorShop.UPDATE_SHOP, this.register.bind(this));
        this.register(this.watcher.shop);
    }
}
