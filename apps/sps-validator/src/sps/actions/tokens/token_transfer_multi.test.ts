import { container } from '../../../__tests__/test-composition-root';
import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
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

test.dbOnly('Garbage data for token_transfer_multi does not crash.', () => {
    return expect(fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for token_transfer_multi does not crash.', () => {
    return expect(fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple token_transfer_multi.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', {
            multi: [
                {
                    token: TOKENS.SPS,
                    to: [
                        {
                            name: 'steemmonsters2',
                            qty: 10,
                        },
                    ],
                },
            ],
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);
});

test.dbOnly('Multiple token_transfer_multi.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');
    await expect(
        fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', {
            multi: [
                {
                    token: TOKENS.SPS,
                    to: [
                        {
                            name: 'steemmonsters2',
                            qty: 10,
                        },
                        {
                            name: 'steemmonsters3',
                            qty: 20,
                        },
                    ],
                },
            ],
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    const balance3 = await fixture.testHelper.getDummyToken('steemmonsters3');
    expect([balance1?.balance, balance2?.balance, balance3?.balance]).toStrictEqual([70, 10, 20]);
});

test.dbOnly('Non Hive account token_transfer_multi is ignored.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await expect(
        fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', {
            multi: [
                {
                    token: TOKENS.SPS,
                    to: [
                        {
                            name: 'steemmonsters2',
                            qty: 10,
                        },
                    ],
                },
            ],
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('System Account recipient in token_transfer_multi is accepted', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await expect(
        fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', {
            multi: [
                {
                    token: TOKENS.SPS,
                    to: [
                        {
                            name: '$SYSTEM',
                            qty: 10,
                        },
                    ],
                },
            ],
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('$SYSTEM');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);
});

test.dbOnly('Lower case system account recipient in token_transfer_multi is rejected', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await expect(
        fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', {
            multi: [
                {
                    token: TOKENS.SPS,
                    to: [
                        {
                            name: '$system',
                            qty: 10,
                        },
                    ],
                },
            ],
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('$system');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('Different token_transfer_multi is ignored for now.', async () => {
    const token1 = 'SPS';
    const token2 = 'GALACTIC_CURRENCY';
    await fixture.testHelper.setDummyToken('steemmonsters', 100, token1);
    await fixture.testHelper.setDummyToken('steemmonsters', 100, token2);
    await fixture.testHelper.setDummyToken('steemmonsters2', 1, token1);
    await fixture.testHelper.setDummyToken('steemmonsters3', 1, token2);
    await expect(
        fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', {
            multi: [
                {
                    token: token1,
                    to: [
                        {
                            name: 'steemmonsters2',
                            qty: 10,
                        },
                    ],
                },
                {
                    token: token2,
                    to: [
                        {
                            name: 'steemmonsters3',
                            qty: 20,
                        },
                    ],
                },
            ],
        }),
    ).resolves.toBeUndefined();

    const balance_1_token_1 = await fixture.testHelper.getDummyToken('steemmonsters', token1);
    const balance_1_token_2 = await fixture.testHelper.getDummyToken('steemmonsters', token2);
    const balance_2_token_1 = await fixture.testHelper.getDummyToken('steemmonsters2', token1);
    const balance_3_token_2 = await fixture.testHelper.getDummyToken('steemmonsters3', token2);
    expect([balance_1_token_1?.balance, balance_1_token_2?.balance, balance_2_token_1?.balance, balance_3_token_2?.balance]).toStrictEqual([100, 100, 1, 1]);
});

test.dbOnly('Not enough balance for one token_transfer_multi.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 10);
    await fixture.testHelper.setDummyToken('steemmonsters2', 1);
    await expect(
        fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', {
            multi: [
                {
                    token: TOKENS.SPS,
                    to: [
                        {
                            name: 'steemmonsters2',
                            qty: 100,
                        },
                    ],
                },
            ],
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([10, 1]);
});

test.dbOnly('Self token_transfer_multi is ignored.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setDummyToken('steemmonsters2', 1);
    await expect(
        fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', {
            multi: [
                {
                    token: TOKENS.SPS,
                    to: [
                        {
                            name: 'steemmonsters2',
                            qty: 10,
                        },
                        {
                            name: 'steemmonsters',
                            qty: 20,
                        },
                    ],
                },
            ],
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, 1]);
});

test.dbOnly('Posting auth token_transfer_multi is ignored.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 10);
    await fixture.testHelper.setDummyToken('steemmonsters2', 1);
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                            },
                        ],
                    },
                ],
            },
            {
                is_active: false,
            },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([10, 1]);
});

test.dbOnly('Multiple token_transfer_multi in different array entries.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');
    await expect(
        fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', {
            multi: [
                {
                    token: TOKENS.SPS,
                    to: [
                        {
                            name: 'steemmonsters2',
                            qty: 10,
                        },
                    ],
                },
                {
                    token: TOKENS.SPS,
                    to: [
                        {
                            name: 'steemmonsters3',
                            qty: 20,
                        },
                    ],
                },
            ],
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    const balance3 = await fixture.testHelper.getDummyToken('steemmonsters3');
    expect([balance1?.balance, balance2?.balance, balance3?.balance]).toStrictEqual([70, 10, 20]);
});

test.dbOnly('Multiple token_transfer_multi to same person.', async () => {
    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setDummyToken('steemmonsters2', 1);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp('token_transfer_multi', 'steemmonsters', {
            multi: [
                {
                    token: TOKENS.SPS,
                    to: [
                        {
                            name: 'steemmonsters2',
                            qty: 10,
                        },
                        {
                            name: 'steemmonsters2',
                            qty: 20,
                        },
                    ],
                },
            ],
        }),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([70, 31]);
});

test.dbOnly('token_transfer_multi with keys before transition has no effect.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy - 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: 'test-key-1',
                            },
                            {
                                name: 'steemmonsters3',
                                qty: 20,
                                key: 'test-key-2',
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    const balance3 = await fixture.testHelper.getDummyToken('steemmonsters3');
    expect([balance1?.balance, balance2?.balance, balance3?.balance]).toStrictEqual([70, 10, 20]);

    // Same keys should work again before transition
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: 'test-key-1',
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum + 1 },
        ),
    ).resolves.toBeUndefined();

    const balance1After = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2After = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1After?.balance, balance2After?.balance]).toStrictEqual([60, 20]);
});

test.dbOnly('token_transfer_multi with invalid keys (number) before transition still succeeds.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy - 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: 123 as any,
                            },
                            {
                                name: 'steemmonsters3',
                                qty: 20,
                                key: 456 as any,
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    const balance3 = await fixture.testHelper.getDummyToken('steemmonsters3');
    // Transfer should succeed despite invalid keys before transition
    expect([balance1?.balance, balance2?.balance, balance3?.balance]).toStrictEqual([70, 10, 20]);
});

test.dbOnly('token_transfer_multi with invalid keys (object) before transition still succeeds.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy - 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: { nested: 'object' } as any,
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should succeed despite invalid key before transition
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);
});

test.dbOnly('token_transfer_multi with valid keys after transition works.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: 'valid-key-1',
                            },
                            {
                                name: 'steemmonsters3',
                                qty: 20,
                                key: 'valid-key-2',
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    const balance3 = await fixture.testHelper.getDummyToken('steemmonsters3');
    expect([balance1?.balance, balance2?.balance, balance3?.balance]).toStrictEqual([70, 10, 20]);
});

test.dbOnly('token_transfer_multi with duplicate keys in same transaction fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: 'duplicate-key',
                            },
                            {
                                name: 'steemmonsters3',
                                qty: 20,
                                key: 'duplicate-key',
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    const balance3 = await fixture.testHelper.getDummyToken('steemmonsters3');
    // Transfer should be ignored due to duplicate keys
    expect([balance1?.balance, balance2?.balance, balance3?.balance]).toStrictEqual([100, undefined, undefined]);
});

test.dbOnly('token_transfer_multi with duplicate keys across transactions fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');

    // First transaction
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: 'cross-tx-key',
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);

    // Second transaction with same key should be ignored
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters3',
                                qty: 20,
                                key: 'cross-tx-key',
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum + 1 },
        ),
    ).resolves.toBeUndefined();

    const balance1After = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2After = await fixture.testHelper.getDummyToken('steemmonsters2');
    const balance3After = await fixture.testHelper.getDummyToken('steemmonsters3');
    // Balances should not change for second transaction
    expect([balance1After?.balance, balance2After?.balance, balance3After?.balance]).toStrictEqual([90, 10, undefined]);
});

test.dbOnly('token_transfer_multi with same keys from different accounts succeeds.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setDummyToken('steemmonsters3', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');

    // First transaction from steemmonsters
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: 'shared-multi-key',
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    // Second transaction from steemmonsters3 with same key should succeed
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters3',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 20,
                                key: 'shared-multi-key',
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum + 1 },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    const balance3 = await fixture.testHelper.getDummyToken('steemmonsters3');
    expect([balance1?.balance, balance2?.balance, balance3?.balance]).toStrictEqual([90, 30, 80]);
});

test.dbOnly('token_transfer_multi with invalid keys (empty string) after transition fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: '',
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should be ignored
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('token_transfer_multi with invalid keys (too long) after transition fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: 'a'.repeat(65),
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should be ignored
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('token_transfer_multi with invalid keys (number) after transition fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: 123 as any,
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should be ignored
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('token_transfer_multi with invalid keys (object) after transition fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: { nested: 'object' } as any,
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    // Transfer should be ignored
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([100, undefined]);
});

test.dbOnly('token_transfer_multi with mixed valid and invalid keys after transition fails.', async () => {
    const blockNum = transitionPoints.transition_points.adjust_token_distribution_strategy + 10;

    await fixture.testHelper.setDummyToken('steemmonsters', 100);
    await fixture.testHelper.setHiveAccount('steemmonsters2');
    await fixture.testHelper.setHiveAccount('steemmonsters3');
    await expect(
        fixture.opsHelper.processOp(
            'token_transfer_multi',
            'steemmonsters',
            {
                multi: [
                    {
                        token: TOKENS.SPS,
                        to: [
                            {
                                name: 'steemmonsters2',
                                qty: 10,
                                key: 'valid-key',
                            },
                            {
                                name: 'steemmonsters3',
                                qty: 20,
                                key: '', // Invalid: empty string
                            },
                        ],
                    },
                ],
            },
            { block_num: blockNum },
        ),
    ).resolves.toBeUndefined();

    const balance1 = await fixture.testHelper.getDummyToken('steemmonsters');
    const balance2 = await fixture.testHelper.getDummyToken('steemmonsters2');
    const balance3 = await fixture.testHelper.getDummyToken('steemmonsters3');
    // Entire transfer should be ignored due to one invalid key
    expect([balance1?.balance, balance2?.balance, balance3?.balance]).toStrictEqual([100, undefined, undefined]);
});
