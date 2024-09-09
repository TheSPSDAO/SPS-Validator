import { Action, EventLog, OperationData, StakingRewardsRepository, Trx } from '@steem-monsters/splinterlands-validator';
import { claim_staking_rewards } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class ClaimStakingRewardsAction extends Action<typeof claim_staking_rewards.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly stakingRewardsRepository: StakingRewardsRepository) {
        super(claim_staking_rewards, op, data, index);
    }

    async validate(_: Trx) {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const claim_results = await this.stakingRewardsRepository.claimAll(this.op.account, 0, this, trx);
        // TODO update validator vote weight? i don't think we have to. staked SPS doesnt change.
        return claim_results;
    }
}

const Builder = MakeActionFactory(ClaimStakingRewardsAction, StakingRewardsRepository);
export const Router = MakeRouter(claim_staking_rewards.action_name, Builder);
