import { container } from '../__tests__/test-composition-root';
import { Fixture as BaseFixture } from '../__tests__/action-fixture';
import { inject, injectable } from 'tsyringe';

import * as presale from '../__tests__/shop/license_tranches/presale.json';
import * as tranche1 from '../__tests__/shop/license_tranches/tranche_1.json';
import * as tranche2 from '../__tests__/shop/license_tranches/tranche_2.json';
import * as tranche3 from '../__tests__/shop/license_tranches/tranche_3.json';
import * as tranche4 from '../__tests__/shop/license_tranches/tranche_4.json';
import * as tranche5 from '../__tests__/shop/license_tranches/tranche_5.json';
import * as tranche6 from '../__tests__/shop/license_tranches/tranche_6.json';
import * as tranche7 from '../__tests__/shop/license_tranches/tranche_7.json';
import * as seedrandom from 'seedrandom';
import { BalanceRepository, LastBlockCache, RawPriceFeed, Shop, Trx, SaleError, ShopItemType, Supply, ShopTokenConfig, BlockEntity } from '@steem-monsters/splinterlands-validator';
import { TOKENS } from './features/tokens';

class Clock {
    constructor(private readonly lastBlockCache: LastBlockCache) {}

    current() {
        return this.lastBlockCache.value?.block_time;
    }
}

class RNG {
    static freshRNG() {
        return seedrandom();
    }
}

@injectable()
class Fixture extends BaseFixture {
    readonly shop: Shop<Trx>;
    constructor(
        @inject(BalanceRepository) private readonly balanceRepository: BalanceRepository,
        @inject(LastBlockCache) readonly lbc: LastBlockCache,
        @inject(RawPriceFeed) private readonly priceFeed: RawPriceFeed,
    ) {
        super();
        const clock = new Clock(this.lbc);
        this.shop = new Shop<Trx>(clock, balanceRepository, priceFeed);
    }

    override async restore() {
        this.shop.clear();
        this.lbc.clear();
        this.priceFeed.clear();
        await super.restore();
    }

    setTokenPrice(token: string, price: number, time: Date) {
        return this.priceFeed.addPriceEntry({
            validator: 'dummyvalidator',
            token,
            token_price: price,
            block_num: 1,
            block_time: time,
        });
    }

    async registerLicenseSale(id: string | symbol, startingBalance = 60000) {
        const presale_ = Shop.from(presale) as ShopTokenConfig;
        const tranches = [tranche1, tranche2, tranche3, tranche4, tranche5, tranche6, tranche7].map(Shop.from);
        fixture.shop.registerSale(id, presale_, ...tranches);
        await this.testHelper.setDummyToken(presale_.balance_account, startingBalance, presale_.token);
    }

    async enrich(account: string, { sps_balance = 10000000 }: { sps_balance?: number } = {}) {
        await this.testHelper.setDummyToken(account, sps_balance, TOKENS.SPS);
    }
}

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.handle.query(BlockEntity).insertItem({ block_num: 0, block_time: new Date(), block_id: '', prev_block_id: '', l2_block_id: '' });
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Fail on non-existent sale', async () => {
    await expect(fixture.shop.precalculateSale('wordempire', { id: 'hello', qty: 1 }, { id: 'some-id' }, RNG.freshRNG())).rejects.toBeInstanceOf(SaleError);
});

test.dbOnly('License tranche sale can be parsed', () => {
    const t = () => [presale, tranche1, tranche2, tranche3, tranche4, tranche5, tranche6, tranche7].map(Shop.from);
    expect(t).not.toThrowError();
});

test.dbOnly('License tranche sale can be registered', () => {
    const t = () => {
        const presale_ = Shop.from(presale);
        const tranches = [tranche1, tranche2, tranche3, tranche4, tranche5, tranche6, tranche7].map(Shop.from);
        fixture.shop.registerSale('validator_tranche_info', presale_, ...tranches);
    };
    expect(t).not.toThrowError();
});

test.dbOnly('Buy random sale', async () => {
    const sale: unique symbol = Symbol.for('sale');
    fixture.shop.registerSale(
        sale,
        Shop.from({
            price: [
                { currency: 'FOO', amount: 10, distribution: { account: 'foo.dao', fraction: 0.75 } },
                { currency: 'SPS', amount: 0.2 },
            ],
            supply: Supply.UNLIMITED,
            type: ShopItemType.TOKEN,
            token: 'BAR',
            item_details_name: 'takes FOO + SPS, gives BAR',
        }),
    );
    await fixture.testHelper.setDummyToken('wordempire', 10, 'FOO');
    await fixture.testHelper.setLiquidSPSBalance('wordempire', 5);
    fixture.lbc.update({ block_num: 1, block_time: new Date(), block_id: 'genesis-block-id' });
    const { result: transfers } = await fixture.shop.precalculateSale('wordempire', { id: sale, qty: 1 }, { id: 'some-id' }, RNG.freshRNG());
    expect(transfers).toContainEqual({ from: '$SHOP', to: 'wordempire', token: 'BAR', amount: 1 });
    expect(transfers).toContainEqual({ from: 'wordempire', to: 'foo.dao', token: 'FOO', amount: 7.5 });
});

test.dbOnly('Buy random sale with distribution array', async () => {
    const sale: unique symbol = Symbol.for('sale');
    fixture.shop.registerSale(
        sale,
        Shop.from({
            price: [
                {
                    currency: 'FOO',
                    amount: 10,
                    distributions: [
                        { account: 'foo.dao', fraction: 0.5 },
                        { account: 'null', fraction: 0.35 },
                    ],
                },
                { currency: 'SPS', amount: 0.2 },
            ],
            supply: Supply.UNLIMITED,
            type: ShopItemType.TOKEN,
            token: 'BAR',
            item_details_name: 'takes FOO + SPS, gives BAR',
        }),
    );
    await fixture.testHelper.setDummyToken('wordempire', 10, 'FOO');
    await fixture.testHelper.setLiquidSPSBalance('wordempire', 5);
    fixture.lbc.update({ block_num: 1, block_time: new Date(), block_id: 'genesis-block-id' });
    const { result: transfers } = await fixture.shop.precalculateSale('wordempire', { id: sale, qty: 1 }, { id: 'some-id' }, RNG.freshRNG());
    expect(transfers).toContainEqual({ from: '$SHOP', to: 'wordempire', token: 'BAR', amount: 1 });
    expect(transfers).toContainEqual({ from: 'wordempire', to: 'foo.dao', token: 'FOO', amount: 5 });
    expect(transfers).toContainEqual({ from: 'wordempire', to: 'null', token: 'FOO', amount: 3.5 });
    expect(transfers).toContainEqual({ from: 'wordempire', to: '$SHOP', token: 'FOO', amount: 1.5 });
});

test.dbOnly('Buy random sale with distribution array where totalFraction sums to 1', async () => {
    const sale: unique symbol = Symbol.for('sale');
    fixture.shop.registerSale(
        sale,
        Shop.from({
            price: [
                {
                    currency: 'FOO',
                    amount: 10,
                    distributions: [
                        { account: 'foo.dao', fraction: 0.5 },
                        { account: 'null', fraction: 0.5 },
                    ],
                },
                { currency: 'SPS', amount: 0.2 },
            ],
            supply: Supply.UNLIMITED,
            type: ShopItemType.TOKEN,
            token: 'BAR',
            item_details_name: 'takes FOO + SPS, gives BAR',
        }),
    );
    await fixture.testHelper.setDummyToken('wordempire', 10, 'FOO');
    await fixture.testHelper.setLiquidSPSBalance('wordempire', 5);
    fixture.lbc.update({ block_num: 1, block_time: new Date(), block_id: 'genesis-block-id' });
    const { result: transfers } = await fixture.shop.precalculateSale('wordempire', { id: sale, qty: 1 }, { id: 'some-id' }, RNG.freshRNG());
    expect(transfers).toContainEqual({ from: '$SHOP', to: 'wordempire', token: 'BAR', amount: 1 });
    expect(transfers).toContainEqual({ from: 'wordempire', to: 'foo.dao', token: 'FOO', amount: 5 });
    expect(transfers).toContainEqual({ from: 'wordempire', to: 'null', token: 'FOO', amount: 5 });
});

test.dbOnly('Buy multiple of a random sale', async () => {
    const sale: unique symbol = Symbol.for('sale');
    fixture.shop.registerSale(
        sale,
        Shop.from({
            price: [{ currency: 'FOO', amount: 10 }],
            supply: Supply.UNLIMITED,
            type: ShopItemType.TOKEN,
            token: 'BAR',
            item_details_name: 'takes FOO, gives BAR',
            max: 10,
        }),
    );
    await fixture.testHelper.setDummyToken('wordempire', 150, 'FOO');
    fixture.lbc.update({ block_num: 1, block_time: new Date(), block_id: 'genesis-block-id' });
    const { result: transfers } = await fixture.shop.precalculateSale('wordempire', { id: sale, qty: 10 }, { id: 'some-id' }, RNG.freshRNG());
    expect(transfers).toContainEqual({ from: '$SHOP', to: 'wordempire', token: 'BAR', amount: 10 });
    expect(transfers).toContainEqual({ from: 'wordempire', to: '$SHOP', token: 'FOO', amount: 100 });
});

test.skip('Buy multiple of a random sale with discount - VOUCHERS REMOVED', async () => {
    const sale: unique symbol = Symbol.for('sale');
    fixture.shop.registerSale(
        sale,
        Shop.from({
            price: [
                {
                    currency: 'USD',
                    amount: 10,
                    accepted_currency: 'FOO',
                },
            ],
            supply: Supply.UNLIMITED,
            discount: {
                currency: 'VOUCHER',
                max_amount: 2,
                discount_rate: 3,
            },
            type: ShopItemType.TOKEN,
            token: 'BAR',
            item_details_name: 'takes FOO, gives BAR',
            max: 10,
        }),
    );
    await fixture.testHelper.setDummyToken('wordempire', 150, 'FOO');
    await fixture.testHelper.setDummyToken('wordempire', 100, 'VOUCHER');
    fixture.lbc.update({ block_num: 1, block_time: new Date(), block_id: 'genesis-block-id' });
    const simpleUSD = 10 * 5;
    const disountUsd = 7 * 3;
    const fooRate = 4;
    await fixture.setTokenPrice('FOO', fooRate, new Date());
    const expectedPriceFoo = (simpleUSD - disountUsd) / fooRate;
    const { result: transfers } = await fixture.shop.precalculateSale('wordempire', { id: sale, qty: 5 }, { id: 'some-id' }, RNG.freshRNG());
    expect(transfers).toContainEqual({ from: '$SHOP', to: 'wordempire', token: 'BAR', amount: 5 });
    expect(transfers).toContainEqual({ from: 'wordempire', to: '$SHOP', token: 'VOUCHER', amount: 7 });
    expect(transfers).toContainEqual({ from: 'wordempire', to: '$SHOP', token: 'FOO', amount: expectedPriceFoo });
});

test.dbOnly('Buy bulk LICENSE presale is prohibited', async () => {
    const sale: unique symbol = Symbol.for('sale');
    fixture.lbc.update({ block_num: 1, block_time: new Date(), block_id: 'genesis-block-id' });
    await fixture.enrich('wordempire');
    await fixture.setTokenPrice('SPS', 0.06721, new Date());
    await fixture.registerLicenseSale(sale);
    await expect(fixture.shop.precalculateSale('wordempire', { id: sale, qty: 11 }, { id: 'some-id' }, RNG.freshRNG())).rejects.toBeInstanceOf(SaleError);
});

test.dbOnly('Buy bulk LICENSE random tranche is allowed', async () => {
    const sale: unique symbol = Symbol.for('sale');
    fixture.lbc.update({ block_num: 1, block_time: new Date(), block_id: 'genesis-block-id' });
    await fixture.enrich('wordempire');

    await fixture.setTokenPrice('SPS', 0.06781, new Date());
    await fixture.registerLicenseSale(sale, 10000);

    const { result: transfers } = await fixture.shop.precalculateSale('wordempire', { id: sale, qty: 11 }, { id: 'some-id' }, RNG.freshRNG());

    expect(transfers).toContainEqual({ from: '$SHOP', to: 'wordempire', token: 'LICENSE', amount: 11 });
});
