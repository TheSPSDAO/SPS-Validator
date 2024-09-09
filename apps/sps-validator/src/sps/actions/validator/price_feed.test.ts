import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture as BaseFixture } from '../../../__tests__/action-fixture';
import { inject, injectable } from 'tsyringe';
import { container } from '../../../__tests__/test-composition-root';
import { BlockEntity, ConfigEntity, PriceFeedConsumer } from '@steem-monsters/splinterlands-validator';

@injectable()
class Fixture extends BaseFixture {
    constructor(@inject(PriceFeedConsumer) readonly consumer: PriceFeedConsumer) {
        super();
    }
}

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();

    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'reward_start_block').updateItem({
        value: '100',
    });

    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'num_top_validators').updateItem({
        value: '2',
    });
    await fixture.handle.query(BlockEntity).insertItem({ block_num: 0, block_time: new Date(), block_id: '', prev_block_id: '', l2_block_id: '' });
    await fixture.testHelper.insertExistingAdmins([]);
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for price_feed does not crash.', () => {
    return expect(fixture.opsHelper.processOp('price_feed', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for price_feed does not crash.', () => {
    return expect(fixture.opsHelper.processOp('price_feed', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Admin price_feed before handover', async () => {
    await fixture.opsHelper.processOp('price_feed', 'steemmonsters', {
        sps_price: 42,
        dec_price: 11,
    });
    const calculated = await fixture.consumer.getPriceAtPoint('SPS', new Date());
    expect(calculated).toBe(42);
});

test.dbOnly('Multiple Admin price_feed before handover', async () => {
    await fixture.testHelper.insertExistingAdmins(['wordempire']);
    await fixture.loader.load();
    await fixture.opsHelper.processOp('price_feed', 'steemmonsters', {
        sps_price: 42,
        dec_price: 11,
    });
    await fixture.opsHelper.processOp('price_feed', 'wordempire', {
        sps_price: 50,
        dec_price: 13,
    });
    const calculated = await fixture.consumer.getPriceAtPoint('SPS', new Date());
    expect(calculated).toBe(46);
});

test.dbOnly.skip('Multiple Admin price_feed before handover with outdated info', async () => {
    await fixture.testHelper.insertExistingAdmins(['wordempire']);
    await fixture.loader.load();
    const now = new Date();
    const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    await fixture.opsHelper.processOp(
        'price_feed',
        'steemmonsters',
        {
            sps_price: 42,
            dec_price: 11,
        },

        {
            block_time: lastYear,
        },
    );
    await fixture.opsHelper.processOp('price_feed', 'wordempire', {
        sps_price: 50,
        dec_price: 13,
    });
    const calculated = await fixture.consumer.getPriceAtPoint('SPS', new Date());
    expect(calculated).toBe(50);
});

test.dbOnly('Non-admin price_feed before handover', async () => {
    await fixture.opsHelper.processOp('price_feed', 'not-steemmonsters', {
        sps_price: 7331,
        dec_price: 10,
    });
    const result = await fixture.testHelper.lookupPriceFeedRecord('not-steemmonsters', 'SPS');
    expect(result).toBeNull();
});

test.dbOnly('Admin price_feed after handover', async () => {
    await fixture.opsHelper.processOp(
        'price_feed',
        'steemmonsters',
        {
            sps_price: 42,
            dec_price: 11,
        },
        { block_num: 200 },
    );
    const result = await fixture.testHelper.lookupPriceFeedRecord('steemmonsters', 'SPS');
    expect(result).toBeNull();
});

test.dbOnly('Non-admin price_feed after handover', async () => {
    await fixture.opsHelper.processOp(
        'price_feed',
        'not-steemmonsters',
        {
            sps_price: 7331,
            dec_price: 10,
        },
        { block_num: 200 },
    );
    const result = await fixture.testHelper.lookupPriceFeedRecord('not-steemmonsters', 'SPS');
    expect(result).toBeNull();
});

test.dbOnly('Active validator price_feed after handover', async () => {
    await fixture.opsHelper.processOp('update_validator', 'steemmonsters', {
        is_active: true,
    });
    await fixture.opsHelper.processOp(
        'price_feed',
        'steemmonsters',
        {
            sps_price: 3.2,
            dec_price: 19,
        },
        { block_num: 200 },
    );
    const calculated = await fixture.consumer.getPriceAtPoint('SPS', new Date());
    expect(calculated).toBe(3.2);
});

test.dbOnly('Inactive validator price_feed after handover', async () => {
    await fixture.opsHelper.processOp('update_validator', 'steemmonsters', {
        is_active: false,
    });
    await fixture.opsHelper.processOp(
        'price_feed',
        'steemmonsters',
        {
            sps_price: 30,
            dec_price: 22,
        },
        { block_num: 200 },
    );
    const result = await fixture.testHelper.lookupPriceFeedRecord('steemmonsters', 'SPS');
    expect(result).toBeNull();
});

test.dbOnly('First admin, then validator price_feed with handover', async () => {
    await fixture.opsHelper.processOp('update_validator', 'wordempire', {
        is_active: true,
    });
    await fixture.opsHelper.processOp('price_feed', 'steemmonsters', {
        sps_price: 20,
        dec_price: 3.6,
    });
    await fixture.opsHelper.processOp(
        'price_feed',
        'wordempire',
        {
            sps_price: 30,
            dec_price: Math.PI,
        },
        { block_num: 200 },
    );
    const calculated = await fixture.consumer.getPriceAtPoint('SPS', new Date());
    expect(calculated).toBe(25);
});
