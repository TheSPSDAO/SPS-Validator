import { Fixture as BaseFixture } from '../../../__tests__/action-fixture';
import { inject, injectable } from 'tsyringe';
import { container } from '../../../__tests__/test-composition-root';
import { ConfigEntity, StakingRewardsRepository } from '@steem-monsters/splinterlands-validator';
import { SpsPool } from '../../pools';

const start_block = 56186000;
const tokens_per_block = 5.32407;

function monthInBlocks(months: number): number {
    return (60 * 60 * 24 * 30 * months) / 3; // approx 1 month in 3 second blocks
}

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
        .updateItem({
            value: JSON.stringify({ type: 'per_block_capped', tokens_per_block: tokens_per_block, start_block: start_block, unstaking_interval_seconds: 1, unstaking_periods: 1 }),
        });

    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('claim_staking_rewards operation with new pool type calculates rewards correctly over the lifetime of the pool.', async () => {
    await fixture.testHelper.setLiquidSPSBalance('steemmonsters', 150);
    await fixture.testHelper.setLiquidSPSBalance(SpsPool.reward_account, 124_000_000);
    await fixture.opsHelper.processOp('stake_tokens', 'steemmonsters', { token: 'SPS', qty: 150 }, { block_num: start_block });

    const steps = [
        { blocks: monthInBlocks(1), expected_reward: 4_140_000 },
        { blocks: monthInBlocks(2), expected_reward: 4_140_000 },
        { blocks: monthInBlocks(3), expected_reward: 4_140_000 },
        { blocks: monthInBlocks(4), expected_reward: 4_140_000 },
        { blocks: monthInBlocks(5), expected_reward: 4_140_000 },
        { blocks: monthInBlocks(6), expected_reward: 4_140_000 },
        { blocks: monthInBlocks(7), expected_reward: 4_140_000 },
        { blocks: monthInBlocks(8), expected_reward: 4_140_000 },
        { blocks: monthInBlocks(9), expected_reward: 4_140_000 },
        { blocks: monthInBlocks(10), expected_reward: 4_140_000 },
        { blocks: monthInBlocks(11), expected_reward: 4_130_000 },
        { blocks: monthInBlocks(12), expected_reward: 3_923_500 },
        { blocks: monthInBlocks(13), expected_reward: 3_727_325 },
        { blocks: monthInBlocks(14), expected_reward: 3_540_959 },
        { blocks: monthInBlocks(15), expected_reward: 3_363_911 },
        { blocks: monthInBlocks(16), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(17), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(18), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(19), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(20), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(21), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(22), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(23), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(24), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(25), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(26), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(27), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(28), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(29), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(30), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(31), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(32), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(33), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(34), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(35), expected_reward: 3_220_000 },
        { blocks: monthInBlocks(36), expected_reward: 3_220_000 },
    ];
    let lastBalance = (await fixture.testHelper.getDummyToken('steemmonsters'))?.balance ?? 0;
    for (const step of steps) {
        await fixture.opsHelper.processOp('claim_staking_rewards', 'steemmonsters', {}, { block_num: start_block + step.blocks });
        const balance = (await fixture.testHelper.getDummyToken('steemmonsters'))?.balance ?? 0;
        const thisClaim = balance - lastBalance;
        // check if thisClaim is within tokens_per_block
        expect(thisClaim).toBeGreaterThanOrEqual(step.expected_reward - tokens_per_block);
        expect(thisClaim).toBeLessThanOrEqual(step.expected_reward + tokens_per_block);
        lastBalance = balance;
    }
});
