import {
    DelegationManager,
    DelegationOfferPromiseHandler,
    DelegationOfferPromiseHandlerOpts,
    PromiseRepository,
    RentalDelegationRepository,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { SpsConfigLoader } from '../../config';
import { TransitionManager } from '../transition';

@injectable()
export class SpsDelegationOfferPromiseHandler extends DelegationOfferPromiseHandler {
    constructor(
        @inject(TransitionManager) private readonly transitionManager: TransitionManager,
        @inject(DelegationManager) delegationManager: DelegationManager,
        @inject(RentalDelegationRepository) rentalDelegationRepository: RentalDelegationRepository,
        @inject(PromiseRepository) promiseRepository: PromiseRepository,
        @inject(SpsConfigLoader) configLoader: SpsConfigLoader,
    ) {
        const opts: DelegationOfferPromiseHandlerOpts = {
            delegation_promise_account: '$DELEGATION_PROMISES',
        };
        super(opts, delegationManager, rentalDelegationRepository, promiseRepository, configLoader);
    }

    protected override shouldNormalizeDelegationOfferQty(block_num: number): boolean {
        return this.transitionManager.isTransitioned('token_precision_fix', block_num);
    }
}
