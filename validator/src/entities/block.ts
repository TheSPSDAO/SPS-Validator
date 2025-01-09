import { sha256 } from 'js-sha256';
import Operation from './operation';
import { Cache } from '../utilities/cache';
import { ValidatorEntry } from './validator/validator';
import { SignedBlock, Transaction } from 'splinterlands-dhive-sl';
import { BaseRepository, Handle, Trx, TransactionEntity, TransactionPlayerEntity, BlockEntity } from '../db/tables';
import { IAction } from '../actions/action';
import { LogObj } from './errors';
import { EventLog, EventTypes } from './event_log';
import { SocketLike } from '../socket';
import { Cloneable, Prime } from '../utilities/traits';
import { log, LogLevel } from '../utils';
import { PRNG } from 'seedrandom';
import seedrandom from 'seedrandom';

export class TransactionRepository extends BaseRepository {
    public constructor(handle: Handle, private readonly socket: SocketLike) {
        super(handle);
    }

    private static stringifyError(error?: LogObj): string | null {
        if (error === undefined) {
            return null;
        } else {
            return JSON.stringify(error.code);
        }
    }

    private static stringifyResult(result?: EventLog<any>[]): string | null {
        if (result === undefined) {
            return null;
        } else {
            return JSON.stringify({ events: result });
        }
    }

    private static from(blockRef: Omit<BlockRef, 'prng'>, action: IAction): [TransactionEntity, TransactionPlayerEntity[]] {
        if (action.isEmpty()) {
            log(`Recording empty action in block`, LogLevel.Warning);
        }

        const players: TransactionPlayerEntity[] = action.players.map((p) => {
            return { transaction_id: action.unique_trx_id, player: p };
        });
        const transaction: TransactionEntity = {
            id: action.unique_trx_id,
            created_date: blockRef.block_time,
            block_num: blockRef.block_num,
            block_id: blockRef.block_id,
            prev_block_id: blockRef.previous,
            type: action.id,
            // TODO: this is the same as op.account
            player: action.players[0],
            data: JSON.stringify(action.params),
            success: action.success ?? null,
            error: TransactionRepository.stringifyError(action.error),
            result: TransactionRepository.stringifyResult(action.result),
        };
        return [transaction, players];
    }

    public async extractFromActions(blockRef: Omit<BlockRef, 'prng'>, actions: IAction[], trx?: Trx) {
        const transformed = actions.map((action) => {
            const [transaction, players] = TransactionRepository.from(blockRef, action);
            return { action, transaction, players };
        });
        const transactions = transformed.map((x) => x.transaction);
        const transactionsPlayers = transformed.flatMap((x) => x.players);
        await this.query(TransactionEntity, trx).insertItems(transactions);
        await this.query(TransactionPlayerEntity, trx).insertItems(transactionsPlayers);

        // Send a socket message for each completed transaction
        transformed.forEach((x) => this.socket.send(x.transaction.player, 'transaction_complete', { error: x.action.error?.message, trx_info: x.transaction }));
        return transactions;
    }
}

export class BlockRepository extends BaseRepository {
    public constructor(handle: Handle, private readonly transactionRepository: TransactionRepository) {
        super(handle);
    }

    public async getBlockHash(block_num: number, trx?: Trx): Promise<Pick<BlockEntity, 'l2_block_id'> | null> {
        return this.query(BlockEntity, trx).select('l2_block_id').where('block_num', block_num).getFirstOrNull();
    }

    public async getLatestBlockNum(trx?: Trx) {
        const record: Record<'block_num', number | null> = await this.query(BlockEntity, trx).max('block_num', 'block_num').getFirst();
        return record.block_num;
    }

    public async getLastBlockNumBefore(date: Date, trx?: Trx) {
        const record: Record<'block_num', number | null> = await this.query(BlockEntity, trx).where('block_time', '<', date).max('block_num', 'block_num').getFirst();
        return record.block_num;
    }

    public async getByBlockNum(block_num: number, trx?: Trx): Promise<BlockEntity | null> {
        return this.query(BlockEntity, trx).where('block_num', block_num).getFirstOrNull();
    }

    public async getMissedBlocks(last_checked_block_num: number, block_num: number, trx?: Trx): Promise<BlockEntity[]> {
        return this.query(BlockEntity, trx)
            .where('block_num', '<=', block_num)
            .where('block_num', '>', last_checked_block_num)
            .whereNotNull('validator')
            .whereNull('validation_tx')
            .orderBy('block_num', 'asc')
            .getMany();
    }

    public async insertValidation(block_num: number, validation_tx: string, trx?: Trx): Promise<EventLog<BlockEntity>> {
        const block = await this.query(BlockEntity, trx).where('block_num', block_num).updateItemWithReturning({ validation_tx });
        return new EventLog(EventTypes.UPDATE, BlockEntity, block);
    }

    public async insertProcessed(block: Omit<NBlock, 'prng'>, operations: Operation[], validator: Pick<ValidatorEntry, 'account_name'> | null, trx?: Trx) {
        const l2transactions = await this.transactionRepository.extractFromActions(
            block,
            operations.flatMap((o) => o.actions),
            trx,
        );
        // TODO: We need a seam to stabilize hash calculation
        const hash = sha256(`${block.prev_block_hash}.${JSON.stringify(l2transactions)}`);
        return this.query(BlockEntity, trx).insertItemWithReturning({
            block_num: block.block_num,
            block_id: block.block_id,
            prev_block_id: block.previous,
            l2_block_id: hash,
            block_time: block.block_time,
            validator: validator?.account_name,
        });
    }
}

export type BlockRef = {
    block_time: Date;
    block_num: number;
    block_id: string;
    previous: string;
    prng: PRNG;
};

type TransactionWithId = {
    transaction: Transaction;
    // TODO: could be `string | undefined`, but not if we assert that SignedBlock.transactions.length === SignedBlock.transaction_ids.length
    id: string;
};

function prngFromBlock(block: SignedBlock): PRNG {
    return seedrandom(`${block.block_id}${block.previous}`);
}

export class NBlock implements BlockRef {
    public readonly block_time: Date;
    public readonly transactions: ReadonlyArray<TransactionWithId>;
    public readonly block_id: string;
    public readonly previous: string;
    public readonly prev_block_hash;
    public readonly prng: PRNG;

    constructor(public readonly block_num: number, block: SignedBlock, previous_block: Pick<BlockEntity, 'l2_block_id'>) {
        this.block_time = new Date(block.timestamp + 'Z');
        this.transactions = block.transactions.map((transaction, index) => {
            return { transaction, id: block.transaction_ids[index] };
        });
        this.block_id = block.block_id;
        this.previous = block.previous;
        this.prev_block_hash = previous_block.l2_block_id;
        this.prng = prngFromBlock(block);
    }
}

type LastBlockData = Omit<BlockRef, 'previous' | 'prng'> | null;

export class LastBlockCache extends Cache<LastBlockData, LastBlockData> implements Cloneable<LastBlockCache>, Prime {
    readonly canUpdate = true;

    constructor(private readonly blockRepository: BlockRepository) {
        super(null);
    }

    async primeCache(trx?: Trx) {
        const block_num = await this.blockRepository.getLatestBlockNum(trx);
        if (block_num !== null) {
            const block = await this.blockRepository.getByBlockNum(block_num, trx);
            this.update(block);
        }
    }

    protected clearImpl(): LastBlockData {
        return null;
    }

    protected reloadImpl(currentState: LastBlockData, newState: LastBlockData): LastBlockData {
        return newState;
    }

    public get size(): number {
        return this.value === null ? 0 : 1;
    }

    protected updateImpl(currentState: LastBlockData, data: LastBlockData): LastBlockData {
        return data;
    }

    clone(): LastBlockCache {
        return new LastBlockCache(this.blockRepository);
    }

    async prime(trx?: Trx): Promise<void> {
        await this.primeCache(trx);
    }
}
