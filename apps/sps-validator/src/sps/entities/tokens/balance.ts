import { inject, injectable } from 'tsyringe';
import { BalanceHistoryRepository, BalanceRepository, Bookkeeping, BurnOpts, Handle } from '@steem-monsters/splinterlands-validator';

@injectable()
export class SpsBalanceRepository extends BalanceRepository {
    public constructor(
        @inject(Handle) handle: Handle,
        @inject(BurnOpts) burnOpts: BurnOpts,
        @inject(BalanceHistoryRepository) balanceHistory: BalanceHistoryRepository,
        @inject(Bookkeeping) bookkeeping: Bookkeeping,
    ) {
        super(handle, burnOpts, balanceHistory, bookkeeping);
    }
}
