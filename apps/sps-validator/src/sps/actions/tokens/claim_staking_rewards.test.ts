import { emoji_payload, garbage_payload } from '../../../__tests__/db-helpers';
import { Fixture as BaseFixture } from '../../../__tests__/action-fixture';
import { inject, injectable } from 'tsyringe';
import { container } from '../../../__tests__/test-composition-root';
import { ConfigEntity, StakingRewardsRepository } from '@steem-monsters/splinterlands-validator';
import { TOKENS } from '../../features/tokens';

@injectable()
class Fixture extends BaseFixture {
    constructor(@inject(StakingRewardsRepository) readonly stakingRewardsRepository: StakingRewardsRepository) {
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

    await fixture.handle.query(ConfigEntity).where('group_name', 'sps').andWhere('name', 'staking_rewards_acc_tokens_per_share').updateItem({ value: '1' });

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Garbage data for claim_staking_rewards does not crash.', () => {
    return expect(fixture.opsHelper.processOp('claim_staking_rewards', 'steemmonsters', garbage_payload)).resolves.toBeUndefined();
});

test.dbOnly('Lots of emoji for claim_staking_rewards does not crash.', () => {
    return expect(fixture.opsHelper.processOp('claim_staking_rewards', 'steemmonsters', emoji_payload)).resolves.toBeUndefined();
});

test.dbOnly('Simple claim_staking_rewards operation.', async () => {
    await fixture.testHelper.setStaked('steemmonsters', 120);
    await fixture.opsHelper.processOp('claim_staking_rewards', 'steemmonsters', {});
    const staked = await fixture.testHelper.getDummyToken('steemmonsters', TOKENS.SPSP);
    const balance = await fixture.testHelper.getDummyToken('steemmonsters');
    expect(staked?.balance).toBe(120);
    // tokens_per_share is set to 1
    expect(balance?.balance).toBe(120);
});
