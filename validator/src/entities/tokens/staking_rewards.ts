import { AwardPool, PoolProps, Pools, PoolSettings, PoolWatch } from '../../config';
import { IAction } from '../../actions/action';
import { BalanceRepository } from './balance';
import { EventLog, EventTypes } from '../event_log';
import { BaseRepository, Handle, StakingPoolRewardDebtEntity, Trx } from '../../db/tables';
import { LogLevel, not_void } from '../../utils';
import * as utils from '../../utils';
import { PoolUpdater } from '../../config/updater';
import { StakingConfiguration } from '../../config/staking';
import { BlockRepository } from '../block';

type StakingPoolRewardDebtEntry = {
    player: string;
    pool_name: string;
    reward_debt: number;
};

type AccountStakedInfo = {
    total_staked: {
        token: string;
        amount: number;
    };
    reward_debt: number;
};

type StakedPoolTotal = {
    total_staked: {
        token: string;
        amount: number;
    };
};

type MappedPoolProps = {
    [key in PoolProps]: number;
} & PoolSettings &
    StakedPoolTotal;

export type StakingIncrease = [number, string] | 0; // [amount, token], or just 0 for a claimAll

class StakingRewardsClaim {
    static table = 'staking_rewards_claim';
    player!: string;
    pool_name!: string;
    token!: string;
    amount!: number;
}

export class StakingRewardsRepository extends BaseRepository {
    constructor(
        handle: Handle,
        private readonly poolUpdater: PoolUpdater,
        private readonly watcher: PoolWatch,
        private readonly balanceRepository: BalanceRepository,
        private readonly pools: Pools<string>,
        private readonly stakingConfiguration: StakingConfiguration,
        private readonly blockRepository: BlockRepository,
    ) {
        super(handle);
    }

    private static from(entry: StakingPoolRewardDebtEntry): StakingPoolRewardDebtEntity {
        return { ...entry, reward_debt: String(entry.reward_debt) };
    }

    async claimAll(player: string, staking_increase: StakingIncrease, action: IAction, trx?: Trx): Promise<EventLog[]> {
        const eventLogs: EventLog[] = [];
        for (const pool of this.pools) {
            const results = await this.claim(player, pool, staking_increase, action, trx);
            eventLogs.push(...results);
        }
        return eventLogs;
    }

    async claim<T extends string>(player: string, pool: AwardPool<T>, staking_increase: StakingIncrease, action: IAction, trx?: Trx) {
        const [staking_amount, staking_token] = staking_increase === 0 ? [0, undefined] : staking_increase;

        const result: EventLog[] = await this.updatePool(pool, action.op.block_num, action.op.block_time, trx);
        if (staking_token && pool.stake !== staking_token) {
            return result;
        }

        const pool_name = pool.name;
        const acc_tokens_per_share = this.watcher.pools?.[`${pool_name}_acc_tokens_per_share`] || 0;
        const staked = await this.balanceRepository.getBalance(player, pool.stake, trx);

        if (staked > 0) {
            // Get the player's "reward debt" balance (this represents all rewards from before the player entered the pool or that they already claimed)
            const reward_debt = await this.getRewardDebt(pool_name, player, trx);
            const claim_amount = +(staked * acc_tokens_per_share - reward_debt).toFixed(3);

            if (claim_amount > 0) {
                result.push(
                    ...(await this.balanceRepository.updateBalance(action, pool.reward_account, player, pool.token, claim_amount, `claim_staking_rewards_${pool_name}`, trx)),
                );

                // a record of the claim amount for bridges
                result.push(
                    new EventLog(
                        EventTypes.INSERT,
                        { table: StakingRewardsClaim.table },
                        { player, pool_name: pool_name as string, token: pool.token, amount: claim_amount, pool: pool_name },
                    ),
                );
            }
        }

        // Update the player's "reward debt" balance
        result.push(await this.upsert({ player, pool_name, reward_debt: (staked + staking_amount) * acc_tokens_per_share }, trx));
        return result;
    }

    private async upsert(payload: StakingPoolRewardDebtEntry, trx?: Trx): Promise<EventLog> {
        const reward_debt = await this.query(StakingPoolRewardDebtEntity, trx)
            .useKnexQueryBuilder((query) => query.insert(StakingRewardsRepository.from(payload)).onConflict(['player', 'pool_name']).merge().returning('*'))
            .getFirst();
        return new EventLog(EventTypes.UPSERT, StakingPoolRewardDebtEntity, reward_debt);
    }

    async updatePool<T extends string>(pool: AwardPool<T>, block_num: number, block_time: Date, trx?: Trx): Promise<EventLog[]> {
        const pools = this.watcher.pools;
        if (!pools) {
            utils.log(`Attempting to update pool parameters while having misconfigured staking settings, ignoring.`, LogLevel.Error);
            return [];
        }
        const pool_name = pool.name;
        const pool_settings = pools[pool_name];
        const last_reward_block = pools[`${pool_name}_last_reward_block`] || pool_settings.start_block;
        const stop_date_utc = pool_settings.stop_date_utc;
        let stop_block = pool_settings.stop_block;
        const stoppedByBlock = stop_block && block_num > stop_block;
        const results: EventLog[] = [];
        const stopDate = typeof stop_date_utc === 'string' ? new Date(stop_date_utc) : stop_date_utc;

        if (stopDate && stopDate < block_time && !stoppedByBlock) {
            const lastBlock = await this.blockRepository.getLastBlockNumBefore(stopDate, trx);
            if (lastBlock === null) {
                stop_block = last_reward_block;
            } else {
                stop_block = lastBlock;
            }
            results.push(...(await this.poolUpdater.updateStopBlock(pool_name, stop_block, trx)));
        }

        const rewardBlock = stop_block === undefined ? block_num : Math.min(stop_block, block_num);

        const contribution = this.getPoolContribution(rewardBlock, last_reward_block, pool_settings);
        if (contribution <= 0) {
            return results;
        }

        let acc_tokens_per_share = pools[`${pool_name}_acc_tokens_per_share`] || 0;

        const total_staked = -1 * (await this.balanceRepository.getBalance(this.stakingConfiguration.staking_account, pool.stake, trx));

        results.push(...(await this.poolUpdater.updateLastRewardBlock(pool_name, rewardBlock, trx)));
        if (total_staked !== 0 && pool_settings.tokens_per_block !== 0) {
            acc_tokens_per_share += contribution / total_staked;
            results.push(...(await this.poolUpdater.updateAccTokensPerShare(pool_name, acc_tokens_per_share, trx)));
        }
        return results;
    }

    private getPoolContribution(block_num: number, last_reward_block: number, params: PoolSettings): number {
        if (block_num <= last_reward_block) {
            return 0;
        }
        const total_decline = this.getPoolDecline(block_num, params);
        return (block_num - last_reward_block) * params.tokens_per_block * total_decline;
    }

    private getPoolDecline(block_num: number, params: PoolSettings): number {
        if (!params.reduction_pct || !params.reduction_blocks) {
            return 1;
        }
        const total_reductions = Math.trunc((block_num - params.start_block) / params.reduction_blocks);
        const reduction_pct = 1 - params.reduction_pct / 100;
        return reduction_pct ** total_reductions;
    }

    async getRewardDebt<T extends string>(pool_name: T, player: string, trx?: Trx): Promise<number> {
        const record = await this.query(StakingPoolRewardDebtEntity, trx).where('player', player).where('pool_name', pool_name).getFirstOrNull();
        const ret_val = record ? parseFloat(record.reward_debt) : 0;
        return isNaN(ret_val) ? 0 : ret_val;
    }

    async getAccountStakedInfo<T extends string>(pool_name: T, player: string, trx?: Trx): Promise<AccountStakedInfo | null> {
        const pool = this.pools.find((p) => p.name === pool_name);
        if (!pool) {
            utils.log(`Attempting to retrieve pool parameters for unknown pool ${pool_name}, ignoring.`, LogLevel.Error);
            return null;
        }
        const balance = await this.balanceRepository.getBalance(player, pool.stake, trx);
        return {
            total_staked: { token: pool.stake, amount: balance },
            reward_debt: await this.getRewardDebt(pool_name, player, trx),
        };
    }

    async getPoolParameters<T extends string>(pool_name: T, trx?: Trx): Promise<MappedPoolProps | null> {
        const pools = this.watcher.pools;
        if (!pools) {
            utils.log(`Attempting to retrieve pool parameters while having misconfigured pool settings, ignoring.`, LogLevel.Error);
            return null;
        }
        const pool = this.pools.find((p) => p.name === pool_name);
        if (!pool) {
            utils.log(`Attempting to retrieve pool parameters for unknown pool ${pool_name}, ignoring.`, LogLevel.Error);
            return null;
        }

        const pool_settings = pools[pool_name];
        const last_reward_block = pools[`${pool_name}_last_reward_block`] || pool_settings.start_block;
        const acc_tokens_per_share = pools[`${pool_name}_acc_tokens_per_share`];
        const total_staked = -1 * (await this.balanceRepository.getBalance(this.stakingConfiguration.staking_account, pool.stake, trx));
        return {
            tokens_per_block: pool_settings.tokens_per_block,
            start_block: pool_settings.start_block,
            stop_block: pool_settings.stop_block,
            stop_date_utc: pool_settings.stop_date_utc,
            reduction_blocks: pool_settings.reduction_blocks,
            reduction_pct: pool_settings.reduction_pct,
            acc_tokens_per_share,
            last_reward_block,
            total_staked: { token: pool.stake, amount: total_staked },
        };
    }

    async getClaimableRewards<T extends string>(player: string, pool: Pick<AwardPool<T>, 'name' | 'stake'>, trx?: Trx): Promise<number> {
        const block_num = await this.blockRepository.getLatestBlockNum(trx);
        if (!block_num) {
            utils.log(`Attempting to get claimable rewards but unable to get latest block number.`, LogLevel.Error);
            return 0;
        }
        const block = await this.blockRepository.getByBlockNum(block_num, trx);
        if (!block) {
            utils.log(`Attempting to get claimable rewards but unable to get latest block.`, LogLevel.Error);
            return 0;
        }
        const { block_time } = block;
        const pools = this.watcher.pools;
        if (!pools) {
            utils.log(`Attempting to get claimable rewards while having misconfigured staking settings.`, LogLevel.Error);
            return 0;
        }

        const pool_name = pool.name;
        const pool_settings = pools[pool_name];
        const last_reward_block = pools[`${pool_name}_last_reward_block`] || pool_settings.start_block;
        const stop_date_utc = pool_settings.stop_date_utc;
        let stop_block = pool_settings.stop_block;
        const stoppedByBlock = stop_block && block_num > stop_block;
        const stopDate = typeof stop_date_utc === 'string' ? new Date(stop_date_utc) : stop_date_utc;

        if (stopDate && stopDate < block_time && !stoppedByBlock) {
            const lastBlock = await this.blockRepository.getLastBlockNumBefore(stopDate, trx);
            if (lastBlock === null) {
                stop_block = last_reward_block;
            } else {
                stop_block = lastBlock;
            }
        }

        const rewardBlock = stop_block === undefined ? block_num : Math.min(stop_block, block_num);

        const contribution = this.getPoolContribution(rewardBlock, last_reward_block, pool_settings);
        const total_staked = -1 * (await this.balanceRepository.getBalance(this.stakingConfiguration.staking_account, pool.stake, trx));

        const acc_tokens_per_share = (pools[`${pool_name}_acc_tokens_per_share`] || 0) + contribution / total_staked;

        const staked = await this.balanceRepository.getBalance(player, pool.stake, trx);
        const reward_debt = await this.getRewardDebt(pool_name, player, trx);
        const claim_amount = +(staked * acc_tokens_per_share - reward_debt).toFixed(3);
        return claim_amount;
    }

    public async stakeTokens(action: IAction, fromPlayer: string, toPlayer: string, token: string, stakedToken: string, qty: number, actionName: string, trx?: Trx) {
        const claim_results = await this.claimUnclaimedRewards(action, toPlayer, stakedToken, qty, trx);
        const balance_results = await this.updatedBalancesAfterStaking(action, fromPlayer, toPlayer, token, stakedToken, qty, actionName, trx);

        return [...claim_results, ...balance_results];
    }

    public async claimUnclaimedRewards(action: IAction, toPlayer: string, stakedToken: string, qty: number, trx?: Trx) {
        return await this.claimAll(toPlayer, [qty, stakedToken!], action, trx);
    }

    public async updatedBalancesAfterStaking(
        action: IAction,
        fromPlayer: string,
        toPlayer: string,
        token: string,
        stakedToken: string,
        qty: number,
        actionName: string,
        trx?: Trx,
    ) {
        const results: Array<EventLog | void> = [];
        if (qty > 0) {
            const updateStakingTotalFromPlayer = await this.balanceRepository.updateBalance(
                action,
                fromPlayer!,
                this.stakingConfiguration.staking_account,
                token,
                qty,
                actionName,
                trx,
            );
            const updateSPSPToPlayer = await this.balanceRepository.updateBalance(action, this.stakingConfiguration.staking_account, toPlayer!, stakedToken, qty, actionName, trx);
            results.push(...updateStakingTotalFromPlayer, ...updateSPSPToPlayer);
        }

        return results.filter(not_void);
    }
}
