import { OperationData, Action, EventLog, Trx } from '@steem-monsters/splinterlands-validator';
import { expire_rental_delegations } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { RentalDelegationRepository } from '@steem-monsters/splinterlands-validator';
import { PromiseManager } from '@steem-monsters/splinterlands-validator';

export class ExpireRentalDelegationsAction extends Action<typeof expire_rental_delegations.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly rentalDelegationRepository: RentalDelegationRepository,
        private readonly promiseManager: PromiseManager,
    ) {
        super(expire_rental_delegations, op, data, index);
    }

    async validate(): Promise<boolean> {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const expiredRentals = await this.rentalDelegationRepository.getExpiredRentals(this.params.block_num, trx);
        const eventLogs: EventLog[] = [];

        for (const rental of expiredRentals) {
            // Reverse the promise, which will trigger DelegationOfferPromiseHandler.reversePromise
            // That handler will undelegate from borrower → lender and mark the rental as expired.
            const reverseLogs = await this.promiseManager.reversePromise(
                {
                    type: rental.promise_type,
                    id: rental.promise_ext_id,
                },
                this,
                trx,
            );
            eventLogs.push(...reverseLogs);
        }

        return eventLogs;
    }
}

const Builder = MakeActionFactory(ExpireRentalDelegationsAction, RentalDelegationRepository, PromiseManager);
export const Router = MakeRouter(expire_rental_delegations.action_name, Builder);
