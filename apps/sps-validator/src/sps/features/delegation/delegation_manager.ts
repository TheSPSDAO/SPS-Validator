import {
    ActiveDelegationsRepository,
    DelegationManager,
    DelegationManagerOpts,
    HiveAccountRepository,
    RentalDelegationRepository,
    TokenSupport,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { SUPPORTED_TOKENS } from '../tokens';
import { TransitionManager } from '../transition';

const DELEGATION_MANAGER_OPTS: DelegationManagerOpts = {
    // 7 days in milliseconds
    undelegation_cooldown_ms: 7 * 24 * 60 * 60 * 1000,
    system_account_whitelist: ['$SOULKEEP'],
};

@injectable()
export class SpsDelegationManager extends DelegationManager {
    constructor(
        @inject(TransitionManager) private readonly transitionManager: TransitionManager,
        @inject(HiveAccountRepository) hiveAccountRepository: HiveAccountRepository,
        @inject(ActiveDelegationsRepository) delegationRepository: ActiveDelegationsRepository,
        @inject(RentalDelegationRepository) rentalDelegationRepository: RentalDelegationRepository,
    ) {
        super(DELEGATION_MANAGER_OPTS, TokenSupport.wrap(SUPPORTED_TOKENS), hiveAccountRepository, delegationRepository, rentalDelegationRepository);
    }

    override shouldGroupTransfersInMultiOps(block_num: number): boolean {
        return this.transitionManager.isTransitioned('fix_multi_undelegate_crash', block_num);
    }
}
