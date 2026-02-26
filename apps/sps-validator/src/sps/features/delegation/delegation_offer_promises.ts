import { DelegationManager, DelegationOfferPromiseHandler, DelegationOfferPromiseHandlerOpts, RentalDelegationRepository } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

const DELEGATION_OFFER_PROMISE_HANDLER_OPTS: DelegationOfferPromiseHandlerOpts = {
    delegation_promise_account: '$DELEGATION_PROMISES',
    default_expiration_blocks: 201600, // ~7 days at 3s/block
};

@injectable()
export class SpsDelegationOfferPromiseHandler extends DelegationOfferPromiseHandler {
    constructor(@inject(DelegationManager) delegationManager: DelegationManager, @inject(RentalDelegationRepository) rentalDelegationRepository: RentalDelegationRepository) {
        super(DELEGATION_OFFER_PROMISE_HANDLER_OPTS, delegationManager, rentalDelegationRepository);
    }
}
