import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture as BaseFixture } from '../../../__tests__/action-fixture';
import { inject, injectable } from 'tsyringe';
import { container } from '../../../__tests__/test-composition-root';
import { BlockEntity, ConfigEntity, PriceFeedConsumer } from '@steem-monsters/splinterlands-validator';
import { SpsConfigLoader } from '../../config';

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
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'num_top_validators').updateItem({
        value: '2',
    });
    await fixture.handle.query(BlockEntity).insertItem({ block_num: 0, block_time: new Date(), block_id: '', prev_block_id: '', l2_block_id: '' });
    await fixture.testHelper.insertExistingAdmins(['steemmonsters']);
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

test.dbOnly('Legacy price_feed', async () => {
    await fixture.opsHelper.processOp(
        'price_feed',
        'steemmonsters',
        {
            sps_price: 3.2,
        },
        { block_num: SpsConfigLoader.DEFAULT.validator.reward_start_block - 1 },
    );
    const calculated = await fixture.consumer.getPriceAtPoint('SPS', new Date());
    expect(calculated).toBe(3.2);
});

test.dbOnly('Legacy price_feed with paused_until_block set', async () => {
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'paused_until_block').updateItem({
        value: '60963790',
    });
    await fixture.loader.load();
    await fixture.opsHelper.processOp(
        'price_feed',
        'steemmonsters',
        {
            sps_price: 3.2,
        },
        { block_num: 60963789 },
    );
    const calculated = await fixture.consumer.getPriceAtPoint('SPS', new Date());
    expect(calculated).toBe(3.2);
});

test.dbOnly('validator price_feed with paused_until_block set', async () => {
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'paused_until_block').updateItem({
        value: '60963790',
    });
    await fixture.loader.load();

    await fixture.testHelper.insertDummyValidator('steemmonsters', true, 10);
    await fixture.testHelper.insertDummyValidator('steemmonsters1', true, 8);
    await fixture.opsHelper.processOp(
        'price_feed',
        'steemmonsters',
        {
            updates: [
                {
                    token: 'SPS',
                    price: 3.2,
                },
            ],
        },
        { block_num: 60963791 },
    );
    const calculated = await fixture.consumer.getPriceAtPoint('SPS', new Date());
    expect(calculated).toBe(3.2);
});

test.dbOnly('Active validator price_feed', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters', true, 10);
    await fixture.testHelper.insertDummyValidator('steemmonsters1', true, 8);
    await fixture.opsHelper.processOp(
        'price_feed',
        'steemmonsters',
        {
            updates: [
                {
                    token: 'SPS',
                    price: 3.2,
                },
            ],
        },
        { block_num: SpsConfigLoader.DEFAULT.validator.reward_start_block + 1 },
    );
    const calculated = await fixture.consumer.getPriceAtPoint('SPS', new Date());
    expect(calculated).toBe(3.2);
});

test.dbOnly('Inactive validator price_feed', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters', false, 10);
    await fixture.testHelper.insertDummyValidator('steemmonsters1', true, 8);
    await fixture.testHelper.insertDummyValidator('steemmonsters2', true, 5);
    await fixture.opsHelper.processOp(
        'price_feed',
        'steemmonsters',
        {
            updates: [
                {
                    token: 'SPS',
                    price: 3.2,
                },
            ],
        },
        { block_num: SpsConfigLoader.DEFAULT.validator.reward_start_block },
    );
    const result = await fixture.testHelper.lookupPriceFeedRecord('steemmonsters', 'SPS');
    expect(result).toBeNull();
});

test.dbOnly('Not top validator price_feed', async () => {
    await fixture.testHelper.insertDummyValidator('steemmonsters', true, 10);
    await fixture.testHelper.insertDummyValidator('steemmonsters1', true, 12);
    await fixture.testHelper.insertDummyValidator('steemmonsters2', true, 15);
    await fixture.opsHelper.processOp(
        'price_feed',
        'steemmonsters2',
        {
            updates: [
                {
                    token: 'SPS',
                    price: 3.2,
                },
            ],
        },
        { block_num: SpsConfigLoader.DEFAULT.validator.reward_start_block },
    );
    const result = await fixture.testHelper.lookupPriceFeedRecord('steemmonsters', 'SPS');
    expect(result).toBeNull();
});
