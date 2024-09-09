import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture as BaseFixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { inject, injectable } from 'tsyringe';
import { BlockEntity, LastBlockCache, RawPriceFeed } from '@steem-monsters/splinterlands-validator';

@injectable()
class Fixture extends BaseFixture {
    constructor(@inject(LastBlockCache) readonly lbc: LastBlockCache, @inject(RawPriceFeed) readonly priceFeed: RawPriceFeed) {
        super();
    }

    override async restore() {
        this.lbc.clear();
        this.priceFeed.clear();
        await super.restore();
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

test.dbOnly('Garbage data for token_award does not crash.', () => {
    return expect(fixture.opsHelper.processOp('shop_purchase', 'hello', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for token_award does not crash.', () => {
    return expect(fixture.opsHelper.processOp('shop_purchase', 'hello', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple shop purchase', async () => {
    const player = 'someplayer';
    const shop = '$SHOP';

    await fixture.testHelper.setHiveAccount(player);
    const initialSystemBalance = { SPS: 0, LICENSE: 100 };
    const initialPlayerBalance = { SPS: 10000000, LICENSE: 0 };

    await fixture.testHelper.setDummyToken(shop, initialSystemBalance.LICENSE, 'LICENSE');

    await fixture.testHelper.setDummyToken(player, initialPlayerBalance.SPS, 'SPS');

    const details = { block_num: 1, block_time: new Date() };
    fixture.lbc.update({ ...details, block_id: 'genesis-block-id' });
    await fixture.priceFeed.addPriceEntry({ ...details, validator: 'someValidator', token: 'SPS', token_price: 1 });

    await fixture.opsHelper.processOp('shop_purchase', player, {
        id: 'validator_tranche_info',
        qty: 5,
    });

    const licensePlayerAfter = (await fixture.testHelper.getDummyToken(player, 'LICENSE'))?.balance;
    const licenseShopAfter = (await fixture.testHelper.getDummyToken(shop, 'LICENSE'))?.balance;

    expect(licensePlayerAfter).toBe(5);
    expect(licenseShopAfter).toBe(95);

    const spsPlayerAfter = (await fixture.testHelper.getDummyToken(player, 'SPS'))?.balance;
    const spsShopAfter = (await fixture.testHelper.getDummyToken(shop, 'SPS'))?.balance;

    expect(spsPlayerAfter).toBe(initialPlayerBalance.SPS - 40000 * 5);
    expect(spsShopAfter).toBe(40000 * 5);
});

test.dbOnly('Wrong discount shop purchase is ignored', async () => {
    const player = 'someplayer';
    const shop = '$SHOP';

    await fixture.testHelper.setHiveAccount(player);
    const initialSystemBalance = { SPS: 0, LICENSE: 100 };
    const initialPlayerBalance = { SPS: 10000000, LICENSE: 0 };

    await fixture.testHelper.setDummyToken(shop, initialSystemBalance.LICENSE, 'LICENSE');

    await fixture.testHelper.setDummyToken(player, initialPlayerBalance.SPS, 'SPS');

    const details = { block_num: 1, block_time: new Date() };
    fixture.lbc.update({ ...details, block_id: 'genesis-block-id' });
    await fixture.priceFeed.addPriceEntry({ ...details, validator: 'someValidator', token: 'SPS', token_price: 1 });

    await fixture.opsHelper.processOp('shop_purchase', player, {
        id: 'validator_tranche_info',
        qty: 5,
        discount_token: {
            token: 'SOME_RANDOM_FAKE_TOKEN',
            qty: 12,
        },
    });

    const licensePlayerAfter = (await fixture.testHelper.getDummyToken(player, 'LICENSE'))?.balance;
    const licenseShopAfter = (await fixture.testHelper.getDummyToken(shop, 'LICENSE'))?.balance;

    expect(licensePlayerAfter).toBe(undefined);
    expect(licenseShopAfter).toBe(100);

    const spsPlayerAfter = (await fixture.testHelper.getDummyToken(player, 'SPS'))?.balance;
    const spsShopAfter = (await fixture.testHelper.getDummyToken(shop, 'SPS'))?.balance;

    expect(spsPlayerAfter).toBe(initialPlayerBalance.SPS);
    expect(spsShopAfter).toBe(undefined);
});

test.skip('shop purchase is properly discounted - VOUCHERS REMOVED', async () => {
    const player = 'someplayer';
    const shop = '$SHOP';

    await fixture.testHelper.setHiveAccount(player);
    const initialSystemBalance = { SPS: 0, LICENSE: 100 };
    const initialPlayerBalance = { SPS: 10000000 };

    await fixture.testHelper.setDummyToken(shop, initialSystemBalance.LICENSE, 'LICENSE');

    await fixture.testHelper.setDummyToken(player, initialPlayerBalance.SPS, 'SPS');

    const details = { block_num: 1, block_time: new Date() };
    fixture.lbc.update({ ...details, block_id: 'genesis-block-id' });
    await fixture.priceFeed.addPriceEntry({ ...details, validator: 'someValidator', token: 'SPS', token_price: 1 });

    await fixture.opsHelper.processOp('shop_purchase', player, {
        id: 'validator_tranche_info',
        qty: 5,
        vouchers_used: 500,
    });

    const licensePlayerAfter = (await fixture.testHelper.getDummyToken(player, 'LICENSE'))?.balance;
    const licenseShopAfter = (await fixture.testHelper.getDummyToken(shop, 'LICENSE'))?.balance;

    expect(licensePlayerAfter).toBe(5);
    expect(licenseShopAfter).toBe(95);

    const spsPlayerAfter = (await fixture.testHelper.getDummyToken(player, 'SPS'))?.balance;
    const spsShopAfter = (await fixture.testHelper.getDummyToken(shop, 'SPS'))?.balance;

    const expectedPrice = 5 * 40000 - 40 * 500;
    expect(spsPlayerAfter).toBe(initialPlayerBalance.SPS - expectedPrice);
    expect(spsShopAfter).toBe(expectedPrice);
});

test.skip('shop purchase applies bonus - VOUCHERS REMOVED', async () => {
    const player = 'someplayer';
    const shop = '$SHOP';

    await fixture.testHelper.setHiveAccount(player);
    const initialSystemBalance = { SPS: 0, LICENSE: 100, VOUCHER: 0 };
    const initialPlayerBalance = { SPS: 10000000, VOUCHER: 1000 };

    await fixture.testHelper.setDummyToken(shop, initialSystemBalance.LICENSE, 'LICENSE');

    await fixture.testHelper.setDummyToken(player, initialPlayerBalance.SPS, 'SPS');

    const details = { block_num: 1, block_time: new Date() };
    fixture.lbc.update({ ...details, block_id: 'genesis-block-id' });
    await fixture.priceFeed.addPriceEntry({ ...details, validator: 'someValidator', token: 'SPS', token_price: 1 });

    await fixture.opsHelper.processOp('shop_purchase', player, {
        id: 'nice_sale',
        qty: 10,
        bonus_token: {
            token: 'VOUCHER',
            qty: 1,
        },
    });

    const licensePlayerAfter = (await fixture.testHelper.getDummyToken(player, 'LICENSE'))?.balance;
    const licenseShopAfter = (await fixture.testHelper.getDummyToken(shop, 'LICENSE'))?.balance;

    expect(licensePlayerAfter).toBe(11);
    expect(licenseShopAfter).toBe(89);

    const voucherPlayerAfter = (await fixture.testHelper.getDummyToken(player, 'VOUCHER'))?.balance;
    const voucherShopAfter = (await fixture.testHelper.getDummyToken(shop, 'VOUCHER'))?.balance;

    expect(voucherPlayerAfter).toBe(999);
    expect(voucherShopAfter).toBe(1);

    const spsPlayerAfter = (await fixture.testHelper.getDummyToken(player, 'SPS'))?.balance;
    const spsShopAfter = (await fixture.testHelper.getDummyToken(shop, 'SPS'))?.balance;

    const expectedPrice = 10;
    expect(spsPlayerAfter).toBe(initialPlayerBalance.SPS - expectedPrice);
    expect(spsShopAfter).toBe(expectedPrice);
});
