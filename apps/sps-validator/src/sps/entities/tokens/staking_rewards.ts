import { inject, injectable } from 'tsyringe';
import { BalanceRepository, Handle, StakingRewardsRepository, Pools, PoolWatch, PoolUpdater, StakingConfiguration, BlockRepository } from '@steem-monsters/splinterlands-validator';

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
    ) {
        super(handle, poolUpdater, watcher, balanceRepository, pools, stakingConfiguration, blockRepository);
    }
}
