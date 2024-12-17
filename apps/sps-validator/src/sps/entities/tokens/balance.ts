import { inject, injectable } from 'tsyringe';
import { BalanceHistoryRepository, BalanceRepository, Bookkeeping, Handle } from '@steem-monsters/splinterlands-validator';
import { BurnOpts } from '../../actions/burn';

@injectable()
export class SpsBalanceRepository extends BalanceRepository {
    public constructor(
        @inject(Handle) handle: Handle,
        @inject(BurnOpts) burnOpts: BurnOpts,
        @inject(BalanceHistoryRepository) balanceHistory: BalanceHistoryRepository,
        @inject(Bookkeeping) bookkeeping: Bookkeeping,
    ) {
        super(handle, balanceHistory, bookkeeping, burnOpts.burned_ledger_account);
    }
}
