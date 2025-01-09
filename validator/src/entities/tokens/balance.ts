import { ActionError, ErrorType } from '../errors';
import { BalanceHistoryRepository } from './balance_history';
import TokenTransfer from './token_transfer';
import { EventLog, EventTypes } from '../event_log';
import { IAction } from '../../actions/action';
import { BalanceEntity, BaseRepository, Handle, Trx } from '../../db/tables';
import { Bookkeeping } from '../bookkeeping';

type BalanceEntry = {
    player: string;
    token: string;
    balance: number;
};

export type GetTokenBalancesParams = {
    tokens: string[];
    limit?: number;
    skip?: number;
    systemAccounts?: boolean;
    count?: boolean;
};

export type GetTokenBalancesResult = {
    count?: number | bigint | string;
    balances: BalanceEntry[];
};

export class BalanceRepository extends BaseRepository {
    public constructor(handle: Handle, private readonly balanceHistory: BalanceHistoryRepository, private readonly bookkeeping: Bookkeeping, private readonly burnAccount: string) {
        super(handle);
    }

    private static into(row: BalanceEntity): BalanceEntry {
        return { ...row, balance: parseFloat(row.balance) };
    }

    private isPrintingAccount = (player: string) => this.bookkeeping.is_bookkeeping_account(player);

    async getBalance(player: string, token: string, trx?: Trx): Promise<number> {
        const query = this.query(BalanceEntity, trx).where('player', player).where('token', token).select('player', 'token', 'balance');

        let record = await query.getSingleOrNull();
        // Between these two awaited promises, something else can also be calling getBalance and inserting a fresh entry. This really shouldn't happen, but since it can and has happened, we need to handle conflicts in a sane way.
        // this method is used in the api AND the block processor. the api is supposed to be readonly though. so add a check that our trx isn't readonly
        // before inserting.
        if (!record && !trx?.readOnly) {
            record = await this.query(BalanceEntity, trx)
                .useKnexQueryBuilder((q) => q.onConflict(['player', 'token']).merge())
                .insertItemWithReturning({ player, token }, ['player', 'token', 'balance']);
        } else if (!record) {
            record = {
                player,
                token,
                balance: '0',
            };
        }
        return BalanceRepository.into(record).balance;
    }

    async getSupply(token: string, trx?: Trx): Promise<number> {
        const query = this.query(BalanceEntity, trx)
            .where('token', token)
            .andWhere('balance', '>', String(0))
            .andWhere('player', '!=', this.burnAccount) // this is wrong. need to check other accounts too
            .sum('balance', 'supply');
        const record = await query.getSingleOrNull();
        if (record?.supply !== null) {
            return parseFloat(record!.supply);
        } else {
            return 0;
        }
    }

    async getBalances(player: string, trx?: Trx): Promise<BalanceEntry[]> {
        const records = await this.query(BalanceEntity, trx).where('player', player).select('player', 'token', 'balance').orderBy('player').orderBy('token').getMany();
        return records.map(BalanceRepository.into);
    }

    async getMultipleBalancesByToken(token: string, players: string[], trx?: Trx): Promise<BalanceEntry[]> {
        const records = await this.query(BalanceEntity, trx)
            .whereIn('player', players)
            .andWhere('token', token)
            .select('player', 'token', 'balance')
            .orderBy('player')
            .orderBy('token')
            .getMany();
        return records.map(BalanceRepository.into);
    }

    async getTokenBalances(params: GetTokenBalancesParams, trx?: Trx): Promise<GetTokenBalancesResult> {
        let query = this.query(BalanceEntity, trx).whereIn('token', params.tokens).orderBy('balance', 'desc').select('player', 'token', 'balance');
        let countQuery = this.query(BalanceEntity, trx).whereIn('token', params.tokens);
        if (params.systemAccounts === false || params.systemAccounts === undefined) {
            query = query.where('player', 'NOT LIKE', '$%');
            countQuery = countQuery.where('player', 'NOT LIKE', '$%');
        }
        const count = params.count ? await countQuery.getCount() : undefined;
        if (params.limit === 0 && params.skip === 0) {
            return {
                count,
                balances: [],
            };
        }

        if (params.limit !== undefined) {
            query = query.limit(params.limit);
        }
        if (params.skip !== undefined) {
            query = query.offset(params.skip);
        }
        const records = await query.getMany();
        return {
            count,
            balances: records.map(BalanceRepository.into),
        };
    }

    async updateBalance(action: IAction, from: string, to: string, token: string, amount: number, type: string | null, trx?: Trx): Promise<EventLog[]> {
        if (amount <= 0 || isNaN(amount)) {
            throw new ActionError('Amount must always be greater than 0', action, ErrorType.AmountNotPositive);
        }

        // Using Promise.all could lead to a deadlock because of starved connection pool.
        const from_balance = await this.getBalance(from, token, trx);
        const to_balance = await this.getBalance(to, token, trx);

        if (!this.isPrintingAccount(from) && from_balance < amount) {
            throw new ActionError('Insufficient balance.', action, ErrorType.InsufficientBalance);
        }

        const updated_from_balance = await this.query(BalanceEntity, trx)
            .where('player', from)
            .where('token', token)
            .useKnexQueryBuilder((query) => query.increment('balance', amount * -1))
            .updateItemWithReturning({}, ['player', 'token', 'balance']);
        const updated_to_balance = await this.query(BalanceEntity, trx)
            .where('player', to)
            .where('token', token)
            .useKnexQueryBuilder((query) => query.increment('balance', amount))
            .updateItemWithReturning({}, ['player', 'token', 'balance']);
        const token_transfer = new TokenTransfer(from, to, amount, token, from_balance, to_balance, type);
        const insertBalanceHistory = await this.balanceHistory.insert(action, token_transfer, trx);
        return [new EventLog(EventTypes.UPDATE, BalanceEntity, updated_from_balance), new EventLog(EventTypes.UPDATE, BalanceEntity, updated_to_balance), ...insertBalanceHistory];
    }
}
