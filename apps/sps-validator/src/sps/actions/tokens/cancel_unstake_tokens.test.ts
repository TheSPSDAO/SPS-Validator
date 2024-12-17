import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { container } from '../../../__tests__/test-composition-root';
import { Fixture } from '../../../__tests__/action-fixture';
import { ConfigEntity } from '@steem-monsters/splinterlands-validator';
import { TOKENS } from '../../features/tokens';

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    await fixture.testHelper.insertDefaultConfiguration();
    await fixture.handle.query(ConfigEntity).where('group_name', 'sps').andWhere('name', 'unstaking_interval_seconds').updateItem({
        value: '1',
    });
    await fixture.handle.query(ConfigEntity).where('group_name', 'sps').andWhere('name', 'unstaking_periods').updateItem({
        value: '1',
    });
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for cancel_unstake_tokens does not crash.', () => {
    return expect(fixture.opsHelper.processOp('cancel_unstake_tokens', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for cancel_unstake_tokens does not crash.', () => {
    return expect(fixture.opsHelper.processOp('cancel_unstake_tokens', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple cancel_unstake_tokens of currently unstaking tokens.', async () => {
    await fixture.testHelper.setUnstakingRecord('steemmonsters', 137);
    await expect(fixture.opsHelper.processOp('cancel_unstake_tokens', 'steemmonsters', { token: TOKENS.SPS })).resolves.toBeUndefined();
    const unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    expect(unstaking).toBeNull();
});

test.dbOnly('Ignore cancel for different token with cancel_unstake_tokens.', async () => {
    await fixture.testHelper.setUnstakingRecord('steemmonsters', 144);
    await expect(
        fixture.opsHelper.processOp('cancel_unstake_tokens', 'steemmonsters', {
            token: TOKENS.SPS + 'but_not_really',
        }),
    ).resolves.toBeUndefined();
    const unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    expect(Number(unstaking?.total_qty)).toBe(144);
});

test.dbOnly('Ignore cancel when there is no unstaking with cancel_unstake_tokens.', () => {
    return expect(
        fixture.opsHelper.processOp('cancel_unstake_tokens', 'steemmonsters', {
            token: TOKENS.SPS,
        }),
    ).resolves.toBeUndefined();
});

test.dbOnly('Simple cancel_unstake_tokens of currently unstaking tokens with posting auth should work.', async () => {
    await fixture.testHelper.setUnstakingRecord('steemmonsters', 137);
    await expect(fixture.opsHelper.processOp('cancel_unstake_tokens', 'steemmonsters', { token: TOKENS.SPS }, { is_active: false })).resolves.toBeUndefined();
    const unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    expect(unstaking).toBeNull();
});
