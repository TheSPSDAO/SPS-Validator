import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { TOKENS } from '../../features/tokens';
import { TransitionCfg } from '../../features/transition';

const fixture = container.resolve(Fixture);
let transitionPoints: TransitionCfg = null!;

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.loader.load();
    transitionPoints = container.resolve(TransitionCfg);
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for token_transfer does not crash.', () => {
    return expect(fixture.opsHelper.processOp('token_transfer', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for token_transfer does not crash.', () => {
    return expect(fixture.opsHelper.processOp('token_transfer', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple token_transfer.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp('token_transfer', 'steemmonsters', {
            token: TOKENS.SPS,
            qty: 10,
            to: 'steemmonsters2',
        }),
    ).resolves.toBeUndefined();
    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);
});

test.dbOnly('Unsupported token_transfer is ignored.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp('token_transfer', 'steemmonsters', {
            token: 'VOUCHER',
            qty: 10,
            to: 'steemmonsters2',
        }),
    ).resolves.toBeUndefined();
    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('Non Hive account token_transfer is ignored.', async () => {
    // TODO: does not actually test that no transaction happened, but these cases cannot be distinguished without diving into the change events.
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await expect(
        fixture.opsHelper.processOp('token_transfer', 'steemmonsters', {
            token: TOKENS.SPS,
            qty: 10,
            to: 'steemmonsters2',
        }),
    ).resolves.toBeUndefined();
    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('System Account recipient in token_transfer is accepted', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await expect(
        fixture.opsHelper.processOp('token_transfer', 'steemmonsters', {
            token: TOKENS.SPS,
            to: '$SYSTEM',
            qty: 10,
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('$SYSTEM');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);
});

test.dbOnly('Lower case system account recipient in token_transfer is rejected', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await expect(
        fixture.opsHelper.processOp('token_transfer', 'steemmonsters', {
            token: TOKENS.SPS,
            to: '$system',
            qty: 10,
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('$system');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('Self token_transfer is ignored.', async () => {
    // TODO: does not actually test that no transaction happened, but these cases cannot be distinguished without diving into the change events.
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await expect(
        fixture.opsHelper.processOp('token_transfer', 'steemmonsters', {
            token: TOKENS.SPS,
            qty: 10,
            to: 'steemmonsters',
        }),
    ).resolves.toBeUndefined();
    const balance = await fixture.testHelper.getDummyToken('steemmonsters');
    expect(balance?.balance).toBe(100);
});

test.dbOnly('Negative token_transfer is ignored.', async () => {
    // TODO: does not actually test that no transaction happened, but these cases cannot be distinguished without diving into the change events.
    await fixture.testHelper.setDummyToken('steemmonsters', 1);
    await fixture.testHelper.setDummyToken('steemmonsters2', 100);
    await expect(
        fixture.opsHelper.processOp('token_transfer', 'steemmonsters', {
            token: TOKENS.SPS,
            qty: -10,
            to: 'steemmonsters2',
        }),
    ).resolves.toBeUndefined();
    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([1, 100]);
});

test.dbOnly('Overconfident token_transfer is ignored.', async () => {
    // TODO: does not actually test that no transaction happened, but these cases cannot be distinguished without diving into the change events.
    await fixture.testHelper.setDummyToken('steemmonsters', 1);
    await fixture.testHelper.setDummyToken('steemmonsters2', 100);
    await expect(
        fixture.opsHelper.processOp('token_transfer', 'steemmonsters', {
            token: TOKENS.SPS,
            qty: 100,
            to: 'steemmonsters2',
        }),
    ).resolves.toBeUndefined();
    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([1, 100]);
});

test.dbOnly('Posting auth token_transfer is ignored.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 50);
    await fixture.testHelper.setDummyToken('steemmonsters2', 50);
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
            },
            { is_active: false },
        ),
    ).resolves.toBeUndefined();
    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([50, 50]);
});

test.dbOnly('token_transfer with key before transition has no effect.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy - 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: 'test-key-1',
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);

    // Same key should work again before transition
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: 'test-key-1',
            },
            { block_num: blockNum + 1 },
        ),
    ).resolves.toBeUndefined();

    const balance1After = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2After = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1After?.balance, balance2After?.balance]).toStrictEqual([80, 20]);
});

test.dbOnly('token_transfer with invalid key (number) before transition still succeeds.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy - 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: 123 as any,
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should succeed despite invalid key before transition
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);
});

test.dbOnly('token_transfer with invalid key (object) before transition still succeeds.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy - 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: { nested: 'object' } as any,
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should succeed despite invalid key before transition
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);
});

test.dbOnly('token_transfer with valid key after transition works.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: 'test-key-2',
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);
});

test.dbOnly('token_transfer with duplicate key after transition fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');

    // First transfer with key
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: 'duplicate-key',
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);

    // Second transfer with same key should be ignored
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: 'duplicate-key',
            },
            { block_num: blockNum + 1 },
        ),
    ).resolves.toBeUndefined();

    const balance1After = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2After = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Balances should not change
    expect([balance1After?.balance, balance2After?.balance]).toStrictEqual([90, 10]);
});

test.dbOnly('token_transfer with same key from different accounts succeeds.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setDummyToken('steemmonsters3', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');

    // First transfer from steemmonsters
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: 'shared-key',
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    // Second transfer from steemmonsters3 with same key should succeed
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters3',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: 'shared-key',
            },
            { block_num: blockNum + 1 },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    const balance3 = await fixture.testHelper.getDummyToken('steemmonsters3');
    expect([balance1?.balance, balance2?.balance, balance3?.balance]).toStrictEqual([90, 20, 90]);
});

test.dbOnly('token_transfer with invalid key (empty string) after transition fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: '',
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should be ignored
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('token_transfer with invalid key (too long) after transition fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: 'a'.repeat(65), // 65 characters, exceeds 64 limit
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should be ignored
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('token_transfer with invalid key (number) after transition fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: 123 as any,
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should be ignored
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('token_transfer with invalid key (object) after transition fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 10,
                to: 'steemmonsters2',
                key: { nested: 'object' } as any,
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should be ignored
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});
