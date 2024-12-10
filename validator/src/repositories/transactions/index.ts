import { TokenTransfer } from './Transaction';
import { BaseRepository, Handle, Trx, TransactionEntity as TransactionEntity } from '../../db/tables';

type TransactionRow = {
    id: string;
    block_id: string;
    prev_block_id: string;
    type: string;
    player: string;
    data: string | null;
    success: boolean | null;
    error: string | null;
    block_num: number | null;
    created_date: Date | null;
    result: string | null;
};

type TokenTransferError = {
    message: string;
    code: number;
    action: string;
};

class TokenTransferTransactionRow {
    public static readonly table: string = 'transactions';
    public readonly id: string;
    public readonly block_id: string;
    public readonly prev_block_id: string;
    public readonly from: string;
    public readonly to: string;
    public readonly qty: number;
    public readonly token: string;
    public readonly memo: string;
    public readonly success: boolean;
    public readonly error: TokenTransferError | null;
    public readonly blockNum: number;

    public constructor(row: TransactionRow) {
        if (row.data === null) throw new Error('data column cannot be empty');
        if (row.block_num === null) throw new Error('block_num cannot be null');

        const data = JSON.parse(row.data);

        this.id = row.id;
        this.block_id = row.block_id;
        this.prev_block_id = row.prev_block_id;
        this.from = row.player;
        this.success = !!row.success;
        this.error = JSON.parse(row.error ?? 'null');
        this.blockNum = row.block_num;
        this.to = data.to;
        this.qty = data.qty;
        this.token = data.token;
        this.memo = data.memo;
    }

    public into(): TokenTransfer {
        return this.success
            ? {
                  id: this.id,
                  memo: this.memo,
                  token: this.token,
                  qty: this.qty,
                  from: this.from,
                  to: this.to,
                  success: true,
              }
            : {
                  id: this.id,
                  memo: this.memo,
                  token: this.token,
                  qty: this.qty,
                  from: this.from,
                  to: this.to,
                  success: false,
                  error: {
                      message: this.error!.message,
                      code: this.error!.code,
                  },
              };
    }
}

export class TransactionRepository_ extends BaseRepository {
    constructor(handle: Handle) {
        super(handle);
    }

    async lookupTokenTransferByBlockNum(blockNum: number, trx?: Trx): Promise<TokenTransfer[]> {
        const result = await this.query(TransactionEntity, trx)
            .whereRaw(`block_num = (SELECT block_num FROM blocks WHERE block_num=${blockNum})`)
            .where('type', 'token_transfer')
            .getMany();
        return result.map((x) => new TokenTransferTransactionRow(x).into());
    }

    async lookupByBlockNum(blockNum: number, trx?: Trx): Promise<TransactionEntity[]> {
        return this.query(TransactionEntity, trx).whereRaw(`block_num = (SELECT block_num FROM blocks WHERE block_num=${blockNum})`).getMany();
    }

    async lookupByTrxId(transactionId: string, trx?: Trx): Promise<TransactionEntity | null> {
        return this.query(TransactionEntity, trx).where('id', transactionId).getFirstOrNull();
    }
}
