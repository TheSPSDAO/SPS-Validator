import { IAction } from '../../actions/action';
import TokenTransfer from './token_transfer';
import { BalanceHistoryEntity, BaseRepository, Handle, Trx } from '../../db/tables';
import { SocketLike } from '../../socket';
import { EventLog, EventTypes } from '../event_log';

type BalanceHistoryEntry = {
    player: string;
    token: string;
    // TODO: Feel like this is a number.
    amount: string;
    balance_start: number;
    balance_end: number;
    block_num: number;
    trx_id: string;
    type: string;
    created_date: Date;
    counterparty: string | null;
};

function extractTransferRecords(action: IAction, token_transfer: TokenTransfer): [BalanceHistoryEntry, BalanceHistoryEntry] {
    const from_history_record = {
        player: token_transfer.from,
        token: token_transfer.token,
        amount: String(token_transfer.amount * -1),
        balance_start: token_transfer.from_start_balance,
        balance_end: token_transfer.from_end_balance,
        block_num: action.op.block_num,
        trx_id: action.op.trx_op_id!,
        type: token_transfer.type!,
        created_date: action.op.block_time,
        counterparty: token_transfer.to,
    };

    const to_history_record = {
        player: token_transfer.to,
        token: token_transfer.token,
        amount: String(token_transfer.amount),
        balance_start: token_transfer.to_start_balance,
        balance_end: token_transfer.to_end_balance,
        block_num: action.op.block_num,
        trx_id: action.op.trx_op_id!,
        type: token_transfer.type!,
        created_date: action.op.block_time,
        counterparty: token_transfer.from,
    };

    return [from_history_record, to_history_record];
}

export class BalanceHistoryRepository extends BaseRepository {
    public constructor(handle: Handle, private readonly socket: SocketLike) {
        super(handle);
    }

    private static into(row: BalanceHistoryEntity): BalanceHistoryEntry {
        return { ...row, balance_start: parseFloat(row.balance_start), balance_end: parseFloat(row.balance_end) };
    }

    private static from(entry: BalanceHistoryEntry): BalanceHistoryEntity {
        return {
            ...entry,
            balance_start: String(entry.balance_start),
            balance_end: entry.balance_end.toFixed(3),
        };
    }

    public async insert(action: IAction, token_transfer: TokenTransfer, trx?: Trx): Promise<EventLog[]> {
        const [from_history_record, to_history_record] = extractTransferRecords(action, token_transfer).map(BalanceHistoryRepository.from);

        // Send balance update socket messages
        if (!token_transfer.from.startsWith('$')) this.socket.send(token_transfer.from, 'balance_update', BalanceHistoryRepository.into(from_history_record));
        if (!token_transfer.to.startsWith('$')) this.socket.send(token_transfer.to, 'balance_update', BalanceHistoryRepository.into(to_history_record));

        await this.query(BalanceHistoryEntity, trx).insertItems([from_history_record, to_history_record]);
        return [new EventLog(EventTypes.INSERT, BalanceHistoryEntity, from_history_record), new EventLog(EventTypes.INSERT, BalanceHistoryEntity, to_history_record)];
    }
}
