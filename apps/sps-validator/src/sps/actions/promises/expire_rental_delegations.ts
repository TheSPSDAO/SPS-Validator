import { OperationData, Action, EventLog, Trx, DelegationManager } from '@steem-monsters/splinterlands-validator';
import { expire_rental_delegations } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { RentalDelegationRepository } from '@steem-monsters/splinterlands-validator';

export class ExpireRentalDelegationsAction extends Action<typeof expire_rental_delegations.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly rentalDelegationRepository: RentalDelegationRepository,
        private readonly delegationManager: DelegationManager,
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
            // Undelegate the rented tokens from borrower back to lender
            const undelegateLogs = await this.delegationManager.undelegate(
                {
                    account: rental.lender,
                    to: rental.lender,
                    from: rental.borrower,
                    qty: rental.qty,
                    token: rental.token,
                    skipDateUpdate: true,
                },
                this,
                trx,
            );
            eventLogs.push(...undelegateLogs);

            // Mark the rental as expired
            const statusLogs = await this.rentalDelegationRepository.updateStatus(rental.id, 'expired', this, trx);
            eventLogs.push(...statusLogs);
        }

        return eventLogs;
    }
}

const Builder = MakeActionFactory(ExpireRentalDelegationsAction, RentalDelegationRepository, DelegationManager);
export const Router = MakeRouter(expire_rental_delegations.action_name, Builder);
