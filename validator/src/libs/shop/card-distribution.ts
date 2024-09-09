import { BalanceGetter, CardConfig, CardToken, Supply } from './types';
import { make_dynamic_pool_iterator, make_probability_iterator } from '../rng-iterator';
import type { PRNG } from 'seedrandom';

function* map<T, W>(it: Iterator<T>, f: (t: T) => W) {
    let value = it.next();
    while (value.done == false) {
        yield f(value.value);
        value = it.next();
    }
}

export class CardDistribution {
    private constructor(private readonly iterator: Iterator<Pick<CardToken, 'token'>, void>) {}
    private static notVoid<T>(x: T | void): x is T {
        return x !== undefined;
    }

    next(qty = 1) {
        return Array.from({ length: qty }, (_, __) => this.iterator.next().value).filter(CardDistribution.notVoid);
    }

    /**
     *
     * @param {CardShopItem} item
     * @param {() => number} rng
     * @param {*} client Database Client
     */
    static async from_item<Cookie = void>(balanceGetter: BalanceGetter<Cookie>, item: CardConfig, rng: PRNG, cookie?: Cookie) {
        const mapping = (b: boolean) => (b ? item.gold : item.common);

        switch (item.supply) {
            case Supply.UNLIMITED:
                return new CardDistribution(map(make_probability_iterator(item.gold_probability || 0, rng), mapping));
            case Supply.LIMITED: {
                // TODO: better to do one query?
                const golds = await balanceGetter.getBalance(item.balance_account, item.gold.token, cookie);
                const commons = await balanceGetter.getBalance(item.balance_account, item.common.token, cookie);
                return new CardDistribution(map(make_dynamic_pool_iterator({ true: golds, false: commons }, rng), mapping));
            }
            default:
                // Empty iterator
                return new CardDistribution([][Symbol.iterator]());
        }
    }
}
