import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
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
    expect([balance1?.balance, balance2?.balance]).toStrictEqual([90, 10]);
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
