import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { container } from '../../../__tests__/test-composition-root';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';
import { TransitionCfg } from '../../features/transition';

const fixture = container.resolve(Fixture);
let transitionPoints: TransitionCfg | null = null;

const MISSED_BLOCKS_ACCOUNT = '$MISSED_BLOCKS';

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.testHelper.setHiveAccount('steemmonsters');
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');
    await fixture.testHelper.setHiveAccount(MISSED_BLOCKS_ACCOUNT);
    await fixture.testHelper.insertDummyValidator('steemmonsters', true, 100);
    await fixture.testHelper.insertDummyValidator('steemmonsters2', true, 100);
    await fixture.testHelper.insertDummyValidator('steemmonsters3', true, 100, null, 0);
    await fixture.loader.load();
    transitionPoints = container.resolve(TransitionCfg);
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for update_missed_blocks does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('update_missed_blocks', MISSED_BLOCKS_ACCOUNT, garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for update_missed_blocks does not crash.', () => {
    return expect(fixture.opsHelper.processVirtualOp('update_missed_blocks', MISSED_BLOCKS_ACCOUNT, emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Increments missed_blocks for validator', async () => {
    const validator = await fixture.testHelper.validator('steemmonsters');
    expect(validator?.missed_blocks).toBe(0);

    await expect(
        fixture.opsHelper.processVirtualOp('update_missed_blocks', MISSED_BLOCKS_ACCOUNT, {
            account: 'steemmonsters',
            checked_block: 100,
            missed_blocks: 5,
        }),
    ).resolves.toBeUndefined();

    const updatedValidator = await fixture.testHelper.validator('steemmonsters');
    expect(updatedValidator?.missed_blocks).toBe(5);
    expect(updatedValidator?.consecutive_missed_blocks).toBe(0);
});

test.dbOnly('Increments missed_blocks multiple times', async () => {
    await expect(
        fixture.opsHelper.processVirtualOp('update_missed_blocks', MISSED_BLOCKS_ACCOUNT, {
            account: 'steemmonsters',
            checked_block: 100,
            missed_blocks: 3,
        }),
    ).resolves.toBeUndefined();

    let validator = await fixture.testHelper.validator('steemmonsters');
    expect(validator?.missed_blocks).toBe(3);
    expect(validator?.consecutive_missed_blocks).toBe(0);

    await expect(
        fixture.opsHelper.processVirtualOp('update_missed_blocks', MISSED_BLOCKS_ACCOUNT, {
            account: 'steemmonsters',
            checked_block: 200,
            missed_blocks: 2,
        }),
    ).resolves.toBeUndefined();

    validator = await fixture.testHelper.validator('steemmonsters');
    expect(validator?.missed_blocks).toBe(5);
    expect(validator?.consecutive_missed_blocks).toBe(0);
});

test.dbOnly('Increments consecutive_missed_blocks after transition', async () => {
    const blockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy + 10;

    await expect(
        fixture.opsHelper.processVirtualOp(
            'update_missed_blocks',
            MISSED_BLOCKS_ACCOUNT,
            {
                account: 'steemmonsters3',
                checked_block: blockNum - 5,
                missed_blocks: 3,
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const validator = await fixture.testHelper.validator('steemmonsters3');
    expect(validator?.missed_blocks).toBe(3);
    expect(validator?.consecutive_missed_blocks).toBe(3);
});

test.dbOnly('Increments consecutive_missed_blocks multiple times after transition', async () => {
    const blockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy + 10;

    await expect(
        fixture.opsHelper.processVirtualOp(
            'update_missed_blocks',
            MISSED_BLOCKS_ACCOUNT,
            {
                account: 'steemmonsters3',
                checked_block: blockNum - 5,
                missed_blocks: 2,
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    let validator = await fixture.testHelper.validator('steemmonsters3');
    expect(validator?.missed_blocks).toBe(2);
    expect(validator?.consecutive_missed_blocks).toBe(2);

    await expect(
        fixture.opsHelper.processVirtualOp(
            'update_missed_blocks',
            MISSED_BLOCKS_ACCOUNT,
            {
                account: 'steemmonsters3',
                checked_block: blockNum,
                missed_blocks: 3,
            },
            { block_num: blockNum + 10 },
        ),
    ).resolves.toBeUndefined();

    validator = await fixture.testHelper.validator('steemmonsters3');
    expect(validator?.missed_blocks).toBe(5);
    expect(validator?.consecutive_missed_blocks).toBe(5);
});

test.dbOnly('Does NOT increment consecutive_missed_blocks before transition', async () => {
    const blockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy - 10;

    await expect(
        fixture.opsHelper.processVirtualOp(
            'update_missed_blocks',
            MISSED_BLOCKS_ACCOUNT,
            {
                account: 'steemmonsters',
                checked_block: blockNum - 5,
                missed_blocks: 4,
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const validator = await fixture.testHelper.validator('steemmonsters');
    expect(validator?.missed_blocks).toBe(4);
    // consecutive_missed_blocks should still be 0 before the transition
    expect(validator?.consecutive_missed_blocks).toBe(0);
});

test.dbOnly('Handles non-existent validator gracefully', async () => {
    await expect(
        fixture.opsHelper.processVirtualOp('update_missed_blocks', MISSED_BLOCKS_ACCOUNT, {
            account: 'non_existent_validator',
            checked_block: 100,
            missed_blocks: 5,
        }),
    ).resolves.toBeUndefined();

    const validator = await fixture.testHelper.validator('non_existent_validator');
    expect(validator).toBeNull();
});

test.dbOnly('Disables validator when consecutive_missed_blocks exceeds threshold', async () => {
    const blockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy + 10;
    const threshold = 5;

    // Set the consecutive_missed_blocks_threshold
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'consecutive_missed_blocks_threshold').updateItem({ value: threshold.toString() });
    await fixture.loader.load();

    // Set initial consecutive missed blocks to just below threshold
    await fixture.handle.knexInstance.raw('UPDATE validators SET consecutive_missed_blocks = ? WHERE account_name = ?', [4, 'steemmonsters3']);

    let validator = await fixture.testHelper.validator('steemmonsters3');
    expect(validator?.consecutive_missed_blocks).toBe(4);
    expect(validator?.is_active).toBe(true);

    // This should push it over the threshold
    await expect(
        fixture.opsHelper.processVirtualOp(
            'update_missed_blocks',
            MISSED_BLOCKS_ACCOUNT,
            {
                account: 'steemmonsters3',
                checked_block: blockNum,
                missed_blocks: 2,
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    validator = await fixture.testHelper.validator('steemmonsters3');
    expect(validator?.consecutive_missed_blocks).toBe(6);
    expect(validator?.is_active).toBe(false);
});

test.dbOnly('Does not disable validator when consecutive_missed_blocks equals threshold', async () => {
    const blockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy + 10;
    const threshold = 5;

    // Set the consecutive_missed_blocks_threshold
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'consecutive_missed_blocks_threshold').updateItem({ value: threshold.toString() });
    await fixture.loader.load();

    // Set initial consecutive missed blocks
    await fixture.handle.knexInstance.raw('UPDATE validators SET consecutive_missed_blocks = ? WHERE account_name = ?', [3, 'steemmonsters3']);

    let validator = await fixture.testHelper.validator('steemmonsters3');
    expect(validator?.consecutive_missed_blocks).toBe(3);
    expect(validator?.is_active).toBe(true);

    // This should bring it to exactly the threshold
    await expect(
        fixture.opsHelper.processVirtualOp(
            'update_missed_blocks',
            MISSED_BLOCKS_ACCOUNT,
            {
                account: 'steemmonsters3',
                checked_block: blockNum,
                missed_blocks: 2,
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    validator = await fixture.testHelper.validator('steemmonsters3');
    expect(validator?.consecutive_missed_blocks).toBe(5);
    // Should still be active when equal to threshold
    expect(validator?.is_active).toBe(true);
});

test.dbOnly('Does not disable validator when threshold is 0 (disabled)', async () => {
    const blockNum = transitionPoints!.transition_points.adjust_token_distribution_strategy + 10;

    // Set threshold to 0 to disable this feature
    await fixture.handle.query(ConfigEntity).where('group_name', 'validator').andWhere('name', 'consecutive_missed_blocks_threshold').updateItem({ value: '0' });
    await fixture.loader.load();

    await expect(
        fixture.opsHelper.processVirtualOp(
            'update_missed_blocks',
            MISSED_BLOCKS_ACCOUNT,
            {
                account: 'steemmonsters3',
                checked_block: blockNum,
                missed_blocks: 100,
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const validator = await fixture.testHelper.validator('steemmonsters3');
    expect(validator?.consecutive_missed_blocks).toBe(100);
    // Should still be active when threshold is 0
    expect(validator?.is_active).toBe(true);
});
