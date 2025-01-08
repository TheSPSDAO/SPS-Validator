import { BaseRepository, Handle, Trx, ActiveDelegationEntity } from '../../db/tables';
import { EventLog, EventTypes } from '../event_log';
import { BlockRef } from '../block';
import { getTableName } from '@wwwouter/typed-knex';
import { BalanceRepository } from './balance';
import { IAction } from '../../actions';
import { TokenSupportEntry } from '../../utilities/token_support';
import { TokenUnstakingRepository } from './token_unstaking';

export type ActiveDelegationsEntry = {
    token: string;
    delegator: string;
    delegatee: string;
    amount: number;
    last_delegation_tx: string;
    last_delegation_date: Date;
    last_undelegation_date: Date | null;
    last_undelegation_tx: string | null;
};

const DELEGATION_ACCOUNT = '$DELEGATION';

export class ActiveDelegationsRepository extends BaseRepository {
    public readonly table = getTableName(ActiveDelegationEntity);

    public constructor(handle: Handle, private readonly balanceRepository: BalanceRepository, private readonly unstakingRepository: TokenUnstakingRepository) {
        super(handle);
    }

    trx_id(block: BlockRef): string {
        return `sl_${this.table}_${block.block_num}`;
    }

    private static intoMany(rows: ActiveDelegationEntity[]) {
        return rows.map(ActiveDelegationsRepository.into);
    }

    private static into(row: ActiveDelegationEntity): ActiveDelegationsEntry {
        return {
            ...row,
            amount: parseFloat(row.amount),
        };
    }

    private static from(entry: ActiveDelegationsEntry): ActiveDelegationEntity {
        return {
            ...entry,
            amount: String(entry.amount),
        };
    }

    public async getAvailableBalance(player: string, token: TokenSupportEntry, trx?: Trx) {
        // TODO we can probably add better typing so we dont need this check.
        if (!token.delegation) {
            throw new Error('Delegation is not supported for the specified token.');
        }

        const token_balance = await this.balanceRepository.getBalance(player, token.token, trx);
        const delegated_balance = await this.balanceRepository.getBalance(player, token.delegation.out_token, trx);
        const balance = token_balance - delegated_balance;
        if (!token.unstakes) return balance;
        const unstaking_record = await this.unstakingRepository.lookup(player, token.unstakes, trx);
        const unstaking_balance = unstaking_record ? +(unstaking_record.total_qty - unstaking_record.total_unstaked) : 0;
        // no precision??
        return balance - unstaking_balance;
    }

    public async delegate(action: IAction, delegator: string, delegatee: string, token: TokenSupportEntry, qty: number, trx?: Trx) {
        // TODO we can probably add better typing so we dont need this check.
        if (!token.delegation) {
            throw new Error('Delegation is not supported for the specified token.');
        }

        const eventLogs: EventLog[] = [];
        eventLogs.push(await this.upsertActiveDelegation(action, delegator, delegatee, token.token, qty, false, trx));
        eventLogs.push(...(await this.balanceRepository.updateBalance(action, DELEGATION_ACCOUNT, delegator, token.delegation.out_token, qty, 'delegate_tokens', trx)));
        eventLogs.push(...(await this.balanceRepository.updateBalance(action, DELEGATION_ACCOUNT, delegatee, token.delegation.in_token, qty, 'delegate_tokens', trx)));
        return eventLogs;
    }

    public async undelegate(action: IAction, delegator: string, delegatee: string, token: TokenSupportEntry, qty: number, trx?: Trx) {
        // TODO we can probably add better typing so we dont need this check.
        if (!token.delegation) {
            throw new Error('Delegation is not supported for the specified token.');
        }

        const eventLogs: EventLog[] = [];
        eventLogs.push(await this.upsertActiveDelegation(action, delegator, delegatee, token.token, qty, true, trx));
        eventLogs.push(...(await this.balanceRepository.updateBalance(action, delegator, DELEGATION_ACCOUNT, token.delegation.out_token, qty, 'undelegate_tokens', trx)));
        eventLogs.push(...(await this.balanceRepository.updateBalance(action, delegatee, DELEGATION_ACCOUNT, token.delegation.in_token, qty, 'undelegate_tokens', trx)));
        return eventLogs;
    }

    public async getActiveDelegation(delegator: string, delegatee: string, token: string, trx?: Trx): Promise<ActiveDelegationsEntry | null> {
        // eslint-disable-next-line prettier/prettier
        const query = this.query(ActiveDelegationEntity, trx).where('delegator', delegator).where('delegatee', delegatee).where('token', token);

        const record = await query.getFirstOrNull();
        if (!record) {
            return null;
        }
        return ActiveDelegationsRepository.into(record);
    }

    public async getActiveDelegations(delegator: string, delegatees: string[], base_token: string, trx?: Trx): Promise<ActiveDelegationsEntry[]> {
        // eslint-disable-next-line prettier/prettier
        const query = this.query(ActiveDelegationEntity, trx)
            .where('delegator', delegator)
            .whereIn('delegatee', delegatees)
            .where('token', base_token)
            .orderBy('delegator')
            .orderBy('delegatee');

        const records = await query.getMany();
        return ActiveDelegationsRepository.intoMany(records);
    }

    private async upsertActiveDelegation(
        action: IAction,
        delegator: string,
        delegatee: string,
        token: string,
        amount: number,
        is_undelegation: boolean,
        trx?: Trx,
    ): Promise<EventLog> {
        let promise = null;

        // TODO this code sucks. need to fix it.
        const active_delegation_record = await this.getActiveDelegation(delegator, delegatee, token, trx);
        if (!active_delegation_record) {
            // if there isn't an active delegation between the accounts already, start a new one
            const new_delegation: ActiveDelegationEntity = {
                token: token,
                delegator: delegator,
                delegatee: delegatee,
                amount: amount.toString(),
                last_delegation_tx: action.unique_trx_id,
                last_delegation_date: action.op.block_time,
                last_undelegation_date: null,
                last_undelegation_tx: null,
            };

            promise = this.query(ActiveDelegationEntity, trx).insertItemWithReturning(new_delegation);
        } else if (is_undelegation) {
            promise = this.query(ActiveDelegationEntity, trx)
                .where('delegator', delegator)
                .where('delegatee', delegatee)
                .where('token', token)
                .updateItemWithReturning({
                    amount: (active_delegation_record.amount - amount).toString(),
                    last_undelegation_tx: action.unique_trx_id,
                    last_undelegation_date: action.op.block_time,
                });
        } else {
            const new_amount = active_delegation_record.amount + amount;
            if (new_amount == 0) {
                promise = this.query(ActiveDelegationEntity, trx).where('delegator', delegator).where('delegatee', delegatee).where('token', token).del();
            } else if (amount < 0) {
                promise = this.query(ActiveDelegationEntity, trx).where('delegator', delegator).where('delegatee', delegatee).where('token', token).updateItemWithReturning({
                    last_delegation_tx: action.unique_trx_id,
                    last_delegation_date: action.op.block_time,
                    amount: new_amount.toString(),
                    last_undelegation_date: null,
                    last_undelegation_tx: null,
                });
            } else {
                // Else update the existing delegation
                promise = this.query(ActiveDelegationEntity, trx)
                    .where('delegator', delegator)
                    .where('delegatee', delegatee)
                    .where('token', token)
                    .updateItemWithReturning({
                        last_delegation_tx: action.unique_trx_id,
                        last_delegation_date: action.op.block_time,
                        amount: (active_delegation_record.amount + amount).toString(),
                    });
            }
        }

        const result = await promise;
        return new EventLog(EventTypes.UPSERT, ActiveDelegationEntity, result as ActiveDelegationEntity);
    }
}
