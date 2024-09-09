import { Fixture as BaseFixture } from '../../../__tests__/action-fixture';
import { inject, injectable } from 'tsyringe';
import { container } from '../../../__tests__/test-composition-root';
import { ConfigEntity, IAction, OperationData, StakingRewardsRepository, Trx } from '@steem-monsters/splinterlands-validator';
import * as seedrandom from 'seedrandom';
import { TOKENS } from '../../features/tokens';

@injectable()
class Fixture extends BaseFixture {
    constructor(@inject(StakingRewardsRepository) readonly stakingRewardsRepository: StakingRewardsRepository) {
        super();
    }

    getStakingParams(name: string) {
        return this.handle.query(ConfigEntity).where('group_name', 'sps').andWhere('name', name).getFirstOrNull();
    }
}

const fixture = container.resolve(Fixture);
const baseBlock = 56186000;
const baseDate = new Date('2022-12-05T13:59:15.000Z');
const stopBlock = baseBlock + 15;
const stopDate = new Date('2022-12-05T14:00:00.000Z');

function generateDummyIAction(account: string, offset: number, date = new Date()) {
    const op: OperationData = {
        account,
        active_auth: false,
        block_num: baseBlock + offset,
        block_reward: 0,
        block_time: date,
        transaction_id: 'dummy-op-trx',
        trx_op_id: '',
        block: {
            prng: seedrandom(),
            block_id: '',
            block_num: baseBlock + offset,
            block_time: date,
            previous: '',
        },
    };
    const dummyAction: IAction = {
        id: 'dummy',
        op,
        params: {},
        players: [],
        unique_trx_id: 'dummy-trx',
        execute(_trx?: Trx): Promise<IAction> {
            return Promise.resolve(dummyAction);
        },
        isEmpty(): boolean {
            return false;
        },
        isSupported(): boolean {
            return false;
        },
    };
    return dummyAction;
}

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
        .updateItem({ value: JSON.stringify({ tokens_per_block: 1, start_block: baseBlock, unstaking_interval_seconds: 1, unstaking_periods: 1, stop_block: stopBlock }) });

    await fixture.handle.query(ConfigEntity).where('group_name', 'sps').andWhere('name', 'staking_rewards_acc_tokens_per_share').updateItem({ value: '1' });
    await fixture.loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

test.dbOnly('Accounts with staked SPS are eligible to receive SPS', async () => {
    const account = 'wordempire';
    const total = 200;
    const staked = 20;
    await fixture.testHelper.setLiquidSPSBalance(account, total);
    await expect(
        fixture.opsHelper.processOp(
            'stake_tokens',
            account,
            {
                token: TOKENS.SPS,
                qty: staked,
            },
            { block_num: baseBlock },
        ),
    ).resolves.toBeUndefined();

    const dummyAction = generateDummyIAction(account, 1);
    await fixture.stakingRewardsRepository.claimAll(account, 0, dummyAction);
    const balance = await fixture.testHelper.getDummyToken(account, TOKENS.SPS);
    expect(balance?.balance).toBeGreaterThan(total - staked);
});

test.dbOnly('Verify stop block', async () => {
    const account = 'wordempire';
    const total = 200;
    const staked = 20;
    await fixture.testHelper.setLiquidSPSBalance(account, total);
    await expect(
        fixture.opsHelper.processOp(
            'stake_tokens',
            account,
            {
                token: TOKENS.SPS,
                qty: staked,
            },
            { block_num: baseBlock },
        ),
    ).resolves.toBeUndefined();

    let intermezzo: number | undefined;
    {
        const dummyAction = generateDummyIAction(account, stopBlock - baseBlock);
        await fixture.stakingRewardsRepository.claimAll(account, 0, dummyAction);
        const balance = await fixture.testHelper.getDummyToken(account, TOKENS.SPS);
        expect(balance?.balance).toBeGreaterThan(total - staked);
        intermezzo = balance?.balance;
    }

    {
        const dummyAction = generateDummyIAction(account, stopBlock - baseBlock + 10);
        await fixture.stakingRewardsRepository.claimAll(account, 0, dummyAction);
        const balance = await fixture.testHelper.getDummyToken(account, TOKENS.SPS);
        expect(balance?.balance).toBe(intermezzo);
    }
});

test.dbOnly('Verify stop block is set after stop_date', async () => {
    const account = 'wordempire';
    {
        const dummyAction = generateDummyIAction(account, 0, stopDate);
        await fixture.stakingRewardsRepository.claimAll(account, 0, dummyAction);
    }
    {
        const afterDate = new Date(stopDate);
        afterDate.setMonth(afterDate.getMonth() + 1);
        const dummyAction = generateDummyIAction(account, 1, afterDate);
        await fixture.stakingRewardsRepository.claimAll(account, 0, dummyAction);
    }
    const results = await fixture.getStakingParams('staking_rewards');
    const value = results?.value ? JSON.parse(results.value) : undefined;
    expect(value?.stop_block).toBeGreaterThanOrEqual(baseBlock);
});

test.dbOnly('[VULN] regression test', async () => {
    const admin = 'admin';
    await fixture.testHelper.insertExistingAdmins([admin]);
    await fixture.loader.load();

    const startBlock = 1;
    const delta = 1000;
    const endBlock = startBlock + delta;
    const account1 = 'wordempire';
    const account2 = 'wordempire2';
    const sponsor = '$SPONSOR';
    await fixture.testHelper.setLiquidSPSBalance(account1, 10);
    await fixture.testHelper.setLiquidSPSBalance(account2, 10);
    await fixture.testHelper.setLiquidSPSBalance(sponsor, 1000);
    await expect(
        fixture.opsHelper.processOp(
            'stake_tokens',
            account1,
            {
                token: TOKENS.SPS,
                qty: 10,
            },
            { block_num: startBlock },
        ),
    ).resolves.toBeUndefined();

    await expect(
        fixture.opsHelper.processOp(
            'stake_tokens',
            account2,
            {
                token: TOKENS.SPS,
                qty: 10,
            },
            { block_num: startBlock },
        ),
    ).resolves.toBeUndefined();

    await expect(
        fixture.opsHelper.processOp(
            'stake_tokens',
            admin,
            {
                from_player: sponsor,
                to_player: account2,
                token: TOKENS.SPS,
                qty: 10,
            },
            { block_num: endBlock },
        ),
    ).resolves.toBeUndefined();

    await expect(
        fixture.opsHelper.processOp(
            'claim_staking_rewards',
            account2,
            {
                token: TOKENS.SPS,
            },
            { block_num: endBlock },
        ),
    ).resolves.toBeUndefined();

    await expect(
        fixture.opsHelper.processOp(
            'claim_staking_rewards',
            account1,
            {
                token: TOKENS.SPS,
            },
            { block_num: endBlock },
        ),
    ).resolves.toBeUndefined();

    {
        const balance1 = (await fixture.testHelper.getDummyToken(account1, TOKENS.SPS))?.balance ?? 0;
        const balance2 = (await fixture.testHelper.getDummyToken(account2, TOKENS.SPS))?.balance ?? 0;
        // For 999 blocks, account 1 and 2 had the same amount of staked SPS.
        // On block 1000, another batch of tokens is staked _to_ account2.
        // This should be strictly bounded by sharing the 1000 _almost_ equally, except for the last block.
        expect(balance2).toBeGreaterThanOrEqual(balance1);
        expect(balance2).toBeLessThanOrEqual(1 + balance1);
        expect(balance1 + balance2).toBeCloseTo(delta);
    }

    await expect(
        fixture.opsHelper.processOp(
            'claim_staking_rewards',
            account2,
            {
                token: TOKENS.SPS,
            },
            { block_num: endBlock + 1 },
        ),
    ).resolves.toBeUndefined();

    await expect(
        fixture.opsHelper.processOp(
            'claim_staking_rewards',
            account1,
            {
                token: TOKENS.SPS,
            },
            { block_num: endBlock + 1 },
        ),
    ).resolves.toBeUndefined();

    {
        const balance1 = (await fixture.testHelper.getDummyToken(account1, TOKENS.SPS))?.balance ?? 0;
        const balance2 = (await fixture.testHelper.getDummyToken(account2, TOKENS.SPS))?.balance ?? 0;
        expect(balance2).toBeGreaterThan(balance1);
    }
});
