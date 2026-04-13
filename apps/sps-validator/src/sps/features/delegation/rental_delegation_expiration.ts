import { PrefixOpts, RentalDelegationExpirationSource, RentalDelegationRepository } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';
import { TransitionCfg } from '../transition';

@injectable()
export class SpsRentalDelegationExpirationSource extends RentalDelegationExpirationSource {
    constructor(
        @inject(PrefixOpts) prefixOpts: PrefixOpts,
        @inject(RentalDelegationRepository) rentalDelegationRepository: RentalDelegationRepository,
        @inject(TransitionCfg) transitionCfg: TransitionCfg,
    ) {
        super(prefixOpts, rentalDelegationRepository, {
            transition_block: transitionCfg.transition_points.delegation_offer_block,
        });
    }
}
