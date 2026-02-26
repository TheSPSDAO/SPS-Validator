import { PrefixOpts, RentalDelegationExpirationSource, RentalDelegationRepository } from '@steem-monsters/splinterlands-validator';
import { inject, injectable } from 'tsyringe';

@injectable()
export class SpsRentalDelegationExpirationSource extends RentalDelegationExpirationSource {
    constructor(
        @inject(PrefixOpts) prefixOpts: PrefixOpts,
        @inject(RentalDelegationRepository) rentalDelegationRepository: RentalDelegationRepository,
    ) {
        super(prefixOpts, rentalDelegationRepository);
    }
}
