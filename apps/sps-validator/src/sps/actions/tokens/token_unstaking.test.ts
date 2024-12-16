import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture as BaseFixture } from '../../../__tests__/action-fixture';
import { inject, injectable } from 'tsyringe';
import { container } from '../../../__tests__/test-composition-root';
import { ConfigEntity, TokenUnstakingRepository } from '@steem-monsters/splinterlands-validator';
import { TOKENS } from '../../features/tokens';

@injectable()
class Fixture extends BaseFixture {
    constructor(@inject(TokenUnstakingRepository) readonly tokenUnstakingRepository: TokenUnstakingRepository) {
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
    await fixture.handle
        .query(ConfigEntity)
        .where('group_name', 'sps')
        .andWhere('name', 'staking_rewards')
        .updateItem({ value: JSON.stringify({ tokens_per_block: 1, start_block: 56186000, unstaking_interval_seconds: 1, unstaking_periods: 1 }) });

    await fixture.handle.query(ConfigEntity).where('group_name', 'sps').andWhere('name', 'staking_rewards_acc_tokens_per_share').updateItem({ value: '0' });

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for token_unstaking does not crash.', () => {
    return expect(fixture.opsHelper.processOp('token_unstaking', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for token_unstaking does not crash.', () => {
    return expect(fixture.opsHelper.processOp('token_unstaking', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple token_unstaking virtual operation of currently unstaked tokens.', async () => {
    await fixture.testHelper.setUnstakingRecord('steemmonsters', 137);
    const unstakingRow = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    await expect(fixture.opsHelper.processVirtualOp('token_unstaking', 'steemmonsters', fixture.tokenUnstakingRepository.boundParams(unstakingRow!))).resolves.toBeUndefined();
    const unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    const balance = await fixture.testHelper.getDummyToken('steemmonsters');
    expect(unstaking).toBeNull();
    expect(balance?.balance).toBe(137);
});

test.dbOnly('Simple token_unstaking on-chain operation of currently unstaked tokens should fail.', async () => {
    await fixture.testHelper.setUnstakingRecord('steemmonsters', 121);
    await expect(
        fixture.opsHelper.processVirtualOp('token_unstaking', 'steemmonsters', {
            player: 'steemmonsters',
            unstake_amount: 121,
            token: TOKENS.SPS,
        }),
    ).resolves.toBeUndefined();
    const unstaking = await fixture.testHelper.getUnstakingRecord('steemmonsters');
    const balance = await fixture.testHelper.getDummyToken('steemmonsters');
    expect(Number(unstaking?.total_qty)).toBe(121);
    // 0 or undefined are both fine
    expect(balance?.balance).toBeFalsy();
});
