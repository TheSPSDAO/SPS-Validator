import {
    DelegationManager,
    DelegationOfferPromiseHandler,
    DelegationOfferPromiseHandlerOpts,
    PromiseRepository,
    RentalDelegationRepository,
} from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { TransitionCfg } from '../transition';

const DELEGATION_OFFER_PROMISE_HANDLER_BASE_OPTS: Omit<DelegationOfferPromiseHandlerOpts, 'controller_creation_block'> = {
    delegation_promise_account: '$DELEGATION_PROMISES',
};

@injectable()
export class SpsDelegationOfferPromiseHandler extends DelegationOfferPromiseHandler {
    constructor(
        @inject(DelegationManager) delegationManager: DelegationManager,
        @inject(RentalDelegationRepository) rentalDelegationRepository: RentalDelegationRepository,
        @inject(PromiseRepository) promiseRepository: PromiseRepository,
        @inject(TransitionCfg) transitionCfg: TransitionCfg,
    ) {
        const opts: DelegationOfferPromiseHandlerOpts = {
            ...DELEGATION_OFFER_PROMISE_HANDLER_BASE_OPTS,
            controller_creation_block: transitionCfg.transition_points.delegation_offer_controller_creation,
        };
        super(opts, delegationManager, rentalDelegationRepository, promiseRepository);
    }
}
