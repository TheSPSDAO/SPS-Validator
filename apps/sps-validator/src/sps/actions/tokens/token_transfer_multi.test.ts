import { container } from '../../../__tests__/test-composition-root';
import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture } from '../../../__tests__/action-fixture';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.loader.load();
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
