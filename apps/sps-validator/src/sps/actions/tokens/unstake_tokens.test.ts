import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);

afterAll(async () => {
    await fixture.dispose();
});

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.handle.query(ConfigEntity).where('group_name', 'sps').andWhere('name', 'unstaking_interval_seconds').updateItem({ value: '1' });
    await fixture.handle.query(ConfigEntity).where('group_name', 'sps').andWhere('name', 'unstaking_periods').updateItem({ value: '1' });
    await fixture.loader.load();
});

test.dbOnly('Garbage data for unstake_tokens does not crash.', () => {
    return expect(fixture.opsHelper.processOp('unstake_tokens', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for unstake_tokens does not crash.', () => {
    return expect(fixture.opsHelper.processOp('unstake_tokens', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple unstake staked tokens ', async () => {
    await fixture.testHelper.setStaked('steemmonsters', 100);
    await expect(
        fixture.opsHelper.processOp('unstake_tokens', 'steemmonsters', {
            token: TOKENS.SPS,
            qty: 10,
        }),
    ).resolves.toBeUndefined();
    const unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    expect(Number(unstaking?.total_qty)).toBe(10);
});

test.dbOnly('Too much unstake staked tokens ', async () => {
    await fixture.testHelper.setStaked('steemmonsters', 5);
    await expect(
        fixture.opsHelper.processOp('unstake_tokens', 'steemmonsters', {
            token: TOKENS.SPS,
            qty: 10,
        }),
    ).resolves.toBeUndefined();
    const unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    expect(unstaking).toBeNull();
});

test.dbOnly('Cannot unstake more than (staked - delegated) amount', async () => {
    await fixture.testHelper.setStaked('steemmonsters', 5);
    await fixture.testHelper.setDelegatedOut('steemmonsters', 5);
    await expect(
        fixture.opsHelper.processOp('unstake_tokens', 'steemmonsters', {
            token: TOKENS.SPS,
            qty: 5,
        }),
    ).resolves.toBeUndefined();
    const unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    expect(unstaking).toBeNull();
});

test.dbOnly('Double unstake', async () => {
    await fixture.testHelper.setStaked('steemmonsters', 20);
    await expect(
        fixture.opsHelper.processOp('unstake_tokens', 'steemmonsters', {
            token: TOKENS.SPS,
            qty: 11,
        }),
    ).resolves.toBeUndefined();
    let unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    expect(Number(unstaking?.total_qty)).toBe(11);
    await expect(
        fixture.opsHelper.processOp('unstake_tokens', 'steemmonsters', {
            token: TOKENS.SPS,
            qty: 9,
        }),
    ).resolves.toBeUndefined();
    unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    expect(Number(unstaking?.total_qty)).toBe(11);
});

test.dbOnly('Unstake unrelated tokens ', async () => {
    await expect(
        fixture.opsHelper.processOp('unstake_tokens', 'steemmonsters', {
            token: TOKENS.SPS + '_but_not_really',
            qty: 10,
        }),
    ).resolves.toBeUndefined();
    const unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    expect(unstaking).toBeNull();
});

test.dbOnly('Simple unstake staked tokens with posting auth', async () => {
    await fixture.testHelper.setStaked('steemmonsters', 100);
    await expect(
        fixture.opsHelper.processOp(
            'unstake_tokens',
            'steemmonsters',
            {
                token: TOKENS.SPS,
                qty: 13,
            },
            { is_active: false },
        ),
    ).resolves.toBeUndefined();
    const unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    expect(unstaking?.total_qty).toBe('13');
});
