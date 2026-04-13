import {
    DelegationManager,
    DelegationOfferPromiseHandler,
    DelegationOfferPromiseHandlerOpts,
    PromiseRepository,
    RentalDelegationRepository,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { TransitionCfg } from '../transition';
import { SpsConfigLoader } from '../../config';

@injectable()
export class SpsDelegationOfferPromiseHandler extends DelegationOfferPromiseHandler {
    constructor(
        @inject(DelegationManager) delegationManager: DelegationManager,
        @inject(RentalDelegationRepository) rentalDelegationRepository: RentalDelegationRepository,
        @inject(PromiseRepository) promiseRepository: PromiseRepository,
        @inject(TransitionCfg) transitionCfg: TransitionCfg,
        @inject(SpsConfigLoader) configLoader: SpsConfigLoader,
    ) {
        const opts: DelegationOfferPromiseHandlerOpts = {
            delegation_promise_account: '$DELEGATION_PROMISES',
            delegation_offer_transition_block: transitionCfg.transition_points.delegation_offer_block,
        };
        super(opts, delegationManager, rentalDelegationRepository, promiseRepository, configLoader);
    }
}
