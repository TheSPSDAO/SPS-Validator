import { inject, injectable } from 'tsyringe';
import { BalanceRepository, Handle, StakingRewardsRepository, Pools, PoolWatch, PoolUpdater, StakingConfiguration, BlockRepository } from '@steem-monsters/splinterlands-validator';
import { TransitionManager } from '../../features/transition';

@injectable()
export class SpsStakingRewardsRepository extends StakingRewardsRepository {
    constructor(
        @inject(Handle) handle: Handle,
        @inject(PoolUpdater) poolUpdater: PoolUpdater,
        @inject(PoolWatch) watcher: PoolWatch,
        @inject(BalanceRepository) balanceRepository: BalanceRepository,
        @inject(Pools) pools: Pools,
        @inject(StakingConfiguration) stakingConfiguration: StakingConfiguration,
        @inject(BlockRepository) blockRepository: BlockRepository,
        @inject(TransitionManager) private readonly transitionManager: TransitionManager,
    ) {
        super(handle, poolUpdater, watcher, balanceRepository, pools, stakingConfiguration, blockRepository);
    }

    override enableV2ClaimRewardsLog(block_num: number): boolean {
        return this.transitionManager.isTransitioned('adjust_token_distribution_strategy', block_num);
    }
}
