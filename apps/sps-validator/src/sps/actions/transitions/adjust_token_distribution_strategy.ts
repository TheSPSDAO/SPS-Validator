//$UNCLAIMED_UNISWAP_REWARDS
import { OperationData, Action, EventLog, Trx, BalanceRepository, ConfigLoader } from '@steem-monsters/splinterlands-validator';
import { transition_adjust_token_distribution_strategy } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { TransitionManager } from '../../features/transition';
import { TOKENS } from '../../features/tokens';

// See https://docs.google.com/spreadsheets/d/1V-9tOcPIfqiJus8Uq_bYA8j0nIBm258KqxloH5x7HJk/edit?gid=1046771149#gid=1046771149
export const UNISWAP_REWARDS_ACCOUNT = '$UNCLAIMED_UNISWAP_REWARDS';
export const TRANSFERS = [
    ['$SPS_STAKING_REWARDS', 79_000_000],
    ['$REWARD_POOLS_LICENSE', 1_000_000],
    ['$REWARD_POOLS_MODERN', 50_000_000],
    ['$REWARD_POOLS_WILD', 50_000_000],
    ['$TOURNAMENTS_DISTRIBUTION', 20_000_000],
] as const;

export const SPS_STAKING_CONFIG = {
    type: 'per_block_capped',
    tokens_per_block: 5.32407,
    start_block: 56186000,
    unstaking_period: 4,
    unstaking_interval_seconds: 604800,
};

export const SPS_VALIDATOR_REWARDS_CONFIG = {
    type: 'per_block_capped',
    tokens_per_block: 2.6388,
    start_block: 67857521,
};

export class AdjustTokenDistributionStrategyAction extends Action<typeof transition_adjust_token_distribution_strategy.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly balanceRepository: BalanceRepository,
        private readonly configLoader: ConfigLoader,
        private readonly transitionManager: TransitionManager,
    ) {
        super(transition_adjust_token_distribution_strategy, op, data, index);
    }

    override isSupported(): boolean {
        return this.op.account === this.transitionManager.transitionAccount && this.transitionManager.isTransitionPoint('adjust_token_distribution_strategy', this.op.block_num);
    }

    async validate() {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const events: EventLog[] = [];

        // Move tokens from UNISWAP_REWARDS_ACCOUNT to the various reward pools
        for (const [to, amount] of TRANSFERS) {
            events.push(...(await this.balanceRepository.updateBalance(this, UNISWAP_REWARDS_ACCOUNT, to, TOKENS.SPS, amount, 'adjust_token_distribution_strategy', trx)));
        }

        // Update the sps staking and license reward pool configs to use the new calculation method
        events.push(
            await this.configLoader.reloadingUpdateConfig('sps', 'staking_rewards', SPS_STAKING_CONFIG, trx),
            await this.configLoader.reloadingUpdateConfig('sps', 'validator_rewards', SPS_VALIDATOR_REWARDS_CONFIG, trx),
            await this.configLoader.reloadingInsertConfig('validator', 'reward_version', 'per_block_capped', trx),
        );

        return events;
    }
}

const Builder = MakeActionFactory(AdjustTokenDistributionStrategyAction, BalanceRepository, ConfigLoader, TransitionManager);
export const Router = MakeRouter(transition_adjust_token_distribution_strategy.action_name, Builder);
