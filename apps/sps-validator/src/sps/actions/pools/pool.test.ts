import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();

    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.handle.query(ConfigEntity).insertItem({
        group_name: 'sps',
        group_type: 'object',
        name: 'inflation_pools',
        index: 0,
        value_type: 'array',
        value: JSON.stringify([]),
    });
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

const approximate_day = 24 * 3600 * 1000;

describe('add_pool', () => {
    test.dbOnly('Garbage data does not crash.', () => {
        return expect(fixture.opsHelper.processOp('add_pool', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
    });

    test.dbOnly('Lots of emoji does not crash.', () => {
        return expect(fixture.opsHelper.processOp('add_pool', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
    });
});

describe('update_pool', () => {
    test.dbOnly('Garbage data does not crash.', () => {
        return expect(fixture.opsHelper.processOp('update_pool', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
    });

    test.dbOnly('Lots of emoji does not crash.', () => {
        return expect(fixture.opsHelper.processOp('update_pool', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
    });
});

describe('disable_pool', () => {
    test.dbOnly('Garbage data does not crash.', () => {
        return expect(fixture.opsHelper.processOp('disable_pool', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
    });

    test.dbOnly('Lots of emoji does not crash.', () => {
        return expect(fixture.opsHelper.processOp('disable_pool', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
    });
});

test.dbOnly('Simple claim', async () => {
    const account = 'wordempire';
    const name = 'somepool';
    await fixture.opsHelper.processOp('add_pool', 'steemmonsters', {
        name,
        token: 'SPS',
        beneficiary: account,
        tokensPerNormalizedDay: 7,
        start: new Date(0),
    });

    const balance_before = (await fixture.testHelper.getDummyToken(account, 'SPS'))?.balance ?? 0;

    await fixture.opsHelper.processVirtualOp('claim_pool', 'steemmonsters', {
        now: new Date(approximate_day),
    });

    const balance_after = (await fixture.testHelper.getDummyToken(account, 'SPS'))!.balance;
    expect(balance_before).toBe(0);
    expect(balance_after).toBeCloseTo(7);
});

test.dbOnly('Multiple claims do not pay out more', async () => {
    const account = 'wordempire';
    const name = 'somepool';
    await fixture.opsHelper.processOp('add_pool', 'steemmonsters', {
        name,
        token: 'SPS',
        beneficiary: account,
        tokensPerNormalizedDay: 17,
        start: new Date(0),
    });

    const balance_before = (await fixture.testHelper.getDummyToken(account, 'SPS'))?.balance ?? 0;

    await fixture.opsHelper.processVirtualOp('claim_pool', 'steemmonsters', {
        now: new Date(approximate_day),
    });

    const balance_after = (await fixture.testHelper.getDummyToken(account, 'SPS'))!.balance;

    await fixture.opsHelper.processVirtualOp('claim_pool', 'steemmonsters', {
        now: new Date(approximate_day),
    });

    const balance_after2 = (await fixture.testHelper.getDummyToken(account, 'SPS'))!.balance;

    expect(balance_before).toBe(0);
    expect(balance_after).toBeCloseTo(17);
    expect(balance_after2).toBeCloseTo(17);
});

test.dbOnly('Updated pool configuration gets reflected in claim amount', async () => {
    const account = 'wordempire';
    const name = 'somepool';
    await fixture.opsHelper.processOp('add_pool', 'steemmonsters', {
        name,
        token: 'SPS',
        beneficiary: account,
        tokensPerNormalizedDay: 17,
        start: new Date(0),
    });

    await fixture.opsHelper.processVirtualOp('claim_pool', 'steemmonsters', {
        now: new Date(approximate_day),
    });

    const first_balance = (await fixture.testHelper.getDummyToken(account, 'SPS'))!.balance;

    await fixture.opsHelper.processOp('update_pool', 'steemmonsters', {
        name,
        tokensPerNormalizedDay: 200,
    });

    await fixture.opsHelper.processVirtualOp('claim_pool', 'steemmonsters', {
        now: new Date(approximate_day * 2),
    });

    const after_balance = (await fixture.testHelper.getDummyToken(account, 'SPS'))!.balance;

    expect(first_balance).toBe(17);
    expect(after_balance).toBeCloseTo(217);
});

test.dbOnly('Updating pool configuration for pool that does not exist does nothing.', async () => {
    const account = 'wordempire';
    await fixture.opsHelper.processOp('update_pool', 'steemmonsters', {
        name: 'somepool',
        token: 'SPS',
        beneficiary: account,
        tokensPerNormalizedDay: 17,
        start: new Date(0),
    });

    const first_balance = (await fixture.testHelper.getDummyToken(account, 'SPS'))?.balance ?? 0;

    await fixture.opsHelper.processVirtualOp('claim_pool', 'steemmonsters', {
        now: new Date(approximate_day),
    });

    const after_balance = (await fixture.testHelper.getDummyToken(account, 'SPS'))?.balance ?? 0;

    expect(first_balance).toBe(0);
    expect(after_balance).toBeCloseTo(0);
});

test.dbOnly('Adding pool configuration for pool that already exists changes nothing.', async () => {
    const account = 'wordempire';
    await fixture.opsHelper.processOp('add_pool', 'steemmonsters', {
        name: 'somepool',
        token: 'SPS',
        beneficiary: account,
        tokensPerNormalizedDay: 22,
        start: new Date(0),
    });

    await fixture.opsHelper.processOp('add_pool', 'steemmonsters', {
        name: 'somepool',
        token: 'SPS',
        beneficiary: account,
        tokensPerNormalizedDay: 7331,
        start: new Date(0),
    });

    const first_balance = (await fixture.testHelper.getDummyToken(account, 'SPS'))?.balance ?? 0;

    await fixture.opsHelper.processVirtualOp('claim_pool', 'steemmonsters', {
        now: new Date(approximate_day),
    });

    const after_balance = (await fixture.testHelper.getDummyToken(account, 'SPS'))!.balance ?? 0;

    expect(first_balance).toBe(0);
    expect(after_balance).toBeCloseTo(22);
});

test.dbOnly('Disabled pool does not pay out claim', async () => {
    const account = 'wordempire';
    const name = 'somepool';
    await fixture.opsHelper.processOp('add_pool', 'steemmonsters', {
        name,
        token: 'SPS',
        beneficiary: account,
        tokensPerNormalizedDay: 7,
        start: new Date(0),
    });

    const balance_before = (await fixture.testHelper.getDummyToken(account, 'SPS'))?.balance ?? 0;

    await fixture.opsHelper.processOp('disable_pool', 'steemmonsters', { name });

    await fixture.opsHelper.processVirtualOp('claim_pool', 'steemmonsters', {
        now: new Date(approximate_day),
    });

    const balance_after = (await fixture.testHelper.getDummyToken(account, 'SPS'))?.balance ?? 0;
    expect(balance_before).toBe(0);
    expect(balance_after).toBe(0);
});

test.dbOnly('Re-enabled pool does not pay out skipped claims', async () => {
    const account = 'wordempire';
    const name = 'somepool';
    await fixture.opsHelper.processOp('add_pool', 'steemmonsters', {
        name,
        token: 'SPS',
        beneficiary: account,
        tokensPerNormalizedDay: 7,
        start: new Date(0),
    });

    const balance_before = (await fixture.testHelper.getDummyToken(account, 'SPS'))?.balance ?? 0;

    await fixture.opsHelper.processOp('disable_pool', 'steemmonsters', { name });

    await fixture.opsHelper.processVirtualOp('claim_pool', 'steemmonsters', {
        now: new Date(approximate_day),
    });

    await fixture.opsHelper.processOp('update_pool', 'steemmonsters', {
        name: 'somepool',
        start: new Date(approximate_day * 2),
    });

    await fixture.opsHelper.processVirtualOp('claim_pool', 'steemmonsters', {
        now: new Date(approximate_day * 3),
    });

    const balance_after = (await fixture.testHelper.getDummyToken(account, 'SPS'))?.balance ?? 0;
    expect(balance_before).toBe(0);
    expect(balance_after).toBeCloseTo(7);
});
