import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.testHelper.setHiveAccount('steemmonsters');
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.insertDummyValidator('steemmonsters', true, 100, 'steemmonsters2');
    await fixture.testHelper.insertDummyValidator('steemmonsters2', true, 100);
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'max_block_age').updateItem({ value: '100' });
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'paused_until_block').updateItem({ value: '10' });
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'min_validators').updateItem({ value: '1' });
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for validate_block does not crash.', () => {
    return expect(fixture.opsHelper.processOp('validate_block', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for validate_block does not crash.', () => {
    return expect(fixture.opsHelper.processOp('validate_block', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Inexistent block does not crash', async () => {
    await fixture.opsHelper.processOp('validate_block', 'steemmonsters', {
        block_num: 50,
        hash: 'some-hash',
    });
    expect(true);
});

test.dbOnly('Existing block works', async () => {
    await fixture.testHelper.insertDummyBlock(11, 'my-hash', 'steemmonsters');
    await fixture.opsHelper.processOp(
        'validate_block',
        'steemmonsters',
        {
            block_num: 11,
            hash: 'my-hash',
        },
        { transaction: 'proper_validate_block' },
    );
    const result = await fixture.testHelper.blockForBlockNumber(11);
    expect(result?.validation_tx).toEqual('proper_validate_block');
});

test.dbOnly('Existing block pays out', async () => {
    await fixture.testHelper.insertDummyBlock(11, 'my-hash', 'steemmonsters2');
    await fixture.opsHelper.processOp(
        'validate_block',
        'steemmonsters2',
        {
            block_num: 11,
            hash: 'my-hash',
        },
        { transaction: 'proper_validate_block', block_reward: [10, 'SPS'] },
    );
    const result = await fixture.testHelper.blockForBlockNumber(11);
    expect(result?.validation_tx).toEqual('proper_validate_block');

    const balance = await fixture.testHelper.getDummyToken('steemmonsters2', 'SPS');
    expect(balance?.balance ?? 0).toEqual(10);
});

test.dbOnly('Existing block works with reward_account', async () => {
    await fixture.testHelper.insertDummyBlock(11, 'my-hash', 'steemmonsters');
    await fixture.opsHelper.processOp(
        'validate_block',
        'steemmonsters',
        {
            block_num: 11,
            hash: 'my-hash',
        },
        { transaction: 'proper_validate_block' },
    );
    const result = await fixture.testHelper.blockForBlockNumber(11);
    expect(result?.validation_tx).toEqual('proper_validate_block');
});

test.dbOnly('Existing block pays out with with reward_account', async () => {
    await fixture.testHelper.insertDummyBlock(11, 'my-hash', 'steemmonsters');
    await fixture.opsHelper.processOp(
        'validate_block',
        'steemmonsters',
        {
            block_num: 11,
            hash: 'my-hash',
        },
        { transaction: 'proper_validate_block', block_reward: [10, 'SPS'] },
    );
    const result = await fixture.testHelper.blockForBlockNumber(11);
    expect(result?.validation_tx).toEqual('proper_validate_block');

    const balance = await fixture.testHelper.getDummyToken('steemmonsters2', 'SPS');
    expect(balance?.balance ?? 0).toEqual(10);
});

test.dbOnly('Existing old block does not work', async () => {
    await fixture.testHelper.insertDummyBlock(11, 'my-hash', 'steemmonsters');
    await fixture.opsHelper.processOp(
        'validate_block',
        'steemmonsters',
        {
            block_num: 11,
            hash: 'my-hash',
        },
        {
            transaction: 'old_validate_block',
            block_num: 7331,
        },
    );
    const result = await fixture.testHelper.blockForBlockNumber(11);
    expect(result?.validation_tx).toBeNull();
});

test.dbOnly('Paused block does not work', async () => {
    await fixture.testHelper.insertDummyBlock(5, 'my-hash', 'steemmonsters');
    await fixture.opsHelper.processOp('validate_block', 'steemmonsters', {
        block_num: 5,
        hash: 'my-hash',
    });
    const result = await fixture.testHelper.blockForBlockNumber(5);
    expect(result?.validation_tx).toBeNull();
});

test.dbOnly('Existing block with existing auth', async () => {
    await fixture.testHelper.insertDummyBlock(11, 'my-hash', 'steemmonsters', 'existing-validation-trx');
    await fixture.opsHelper.processOp('validate_block', 'steemmonsters', {
        block_num: 11,
        hash: 'my-hash',
    });
    const result = await fixture.testHelper.blockForBlockNumber(11);
    expect(result?.validation_tx).toEqual('existing-validation-trx');
});

test.dbOnly('Existing block with wrong hash', async () => {
    await fixture.testHelper.insertDummyBlock(11, 'my-hash', 'steemmonsters');
    await fixture.opsHelper.processOp('validate_block', 'steemmonsters', {
        block_num: 11,
        hash: 'not-my-hash',
    });
    const result = await fixture.testHelper.blockForBlockNumber(11);
    expect(result?.validation_tx).toBeNull();
});

test.dbOnly('Existing block with wrong validator', async () => {
    await fixture.testHelper.insertDummyBlock(11, 'my-hash', 'not-steemmonsters');
    await fixture.opsHelper.processOp('validate_block', 'steemmonsters', {
        block_num: 11,
        hash: 'not-my-hash',
    });
    const result = await fixture.testHelper.blockForBlockNumber(11);
    expect(result?.validation_tx).toBeNull();
});
