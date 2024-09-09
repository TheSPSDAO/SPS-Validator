import { ActiveDelegationsRepository, DelegationManager, DelegationManagerOpts, HiveAccountRepository, TokenSupport } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { SUPPORTED_TOKENS } from '../tokens';

const DELEGATION_MANAGER_OPTS: DelegationManagerOpts = {
    // 7 days in milliseconds
    undelegation_cooldown_ms: 7 * 24 * 60 * 60 * 1000,
};

@injectable()
export class SpsDelegationManager extends DelegationManager {
    constructor(
        @inject(HiveAccountRepository) hiveAccountRepository: HiveAccountRepository,
        @inject(ActiveDelegationsRepository) delegationRepository: ActiveDelegationsRepository,
    ) {
        super(DELEGATION_MANAGER_OPTS, TokenSupport.wrap(SUPPORTED_TOKENS), hiveAccountRepository, delegationRepository);
    }
}
