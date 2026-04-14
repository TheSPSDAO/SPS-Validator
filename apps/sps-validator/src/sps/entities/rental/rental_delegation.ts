import { inject, injectable } from 'tsyringe';
import { Handle, RentalDelegationRepository } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsRentalDelegationRepository extends RentalDelegationRepository {
    public constructor(@inject(Handle) handle: Handle) {
        super(handle);
    }
}
