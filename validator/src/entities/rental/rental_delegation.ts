import { BaseRepository, Handle, RentalDelegationEntity, RentalDelegationStatus, Trx } from '../../db/tables';
import { EventLog, EventTypes } from '../event_log';
import { IAction } from '../../actions';

export type RentalDelegationEntry = {
    id: string;
    promise_type: string;
    promise_ext_id: string;
    lender: string;
    borrower: string;
    token: string;
    qty: number;
    expiration_block: number;
    start_block: number;
    expiration_blocks: number;
    status: RentalDelegationStatus;
    created_date: Date;
    updated_date: Date;
};

export type CreateRentalDelegationRequest = {
    id: string;
    promise_type: string;
    promise_ext_id: string;
    lender: string;
    borrower: string;
    token: string;
    qty: number;
    expiration_blocks: number;
    start_block: number;
};

export class RentalDelegationRepository extends BaseRepository {
    public constructor(handle: Handle) {
        super(handle);
    }

    private static into(row: RentalDelegationEntity): RentalDelegationEntry {
        return {
            ...row,
            qty: parseFloat(row.qty),
        };
    }

    private static intoMany(rows: RentalDelegationEntity[]): RentalDelegationEntry[] {
        return rows.map(RentalDelegationRepository.into);
    }

    /**
     * Create a new rental delegation record when a delegation offer is filled.
     */
    public async create(request: CreateRentalDelegationRequest, action: IAction, trx?: Trx): Promise<[RentalDelegationEntry, EventLog[]]> {
        const entity: RentalDelegationEntity = {
            id: request.id,
            promise_type: request.promise_type,
            promise_ext_id: request.promise_ext_id,
            lender: request.lender,
            borrower: request.borrower,
            token: request.token,
            qty: request.qty.toString(),
            expiration_block: request.start_block + request.expiration_blocks,
            start_block: request.start_block,
            expiration_blocks: request.expiration_blocks,
            status: 'active',
            created_date: action.op.block_time,
            updated_date: action.op.block_time,
        };

        const result = await this.query(RentalDelegationEntity, trx).insertItemWithReturning(entity);
        const entry = RentalDelegationRepository.into(result as RentalDelegationEntity);
        return [entry, [new EventLog(EventTypes.INSERT, RentalDelegationEntity, result)]];
    }

    /**
     * Get a rental delegation by its ID.
     */
    public async getById(id: string, trx?: Trx): Promise<RentalDelegationEntry | null> {
        const record = await this.query(RentalDelegationEntity, trx).where('id', id).getFirstOrNull();
        if (!record) return null;
        return RentalDelegationRepository.into(record);
    }

    /**
     * Get all active rental delegations that have expired (their expiration_block <= current block).
     */
    public async getExpiredRentals(currentBlock: number, trx?: Trx): Promise<RentalDelegationEntry[]> {
        const records = await this.query(RentalDelegationEntity, trx)
            .where('status', 'active')
            .where('expiration_block', '<=', currentBlock)
            .orderBy('expiration_block', 'asc')
            .orderBy('id', 'asc')
            .getMany();
        return RentalDelegationRepository.intoMany(records);
    }

    /**
     * Count active rental delegations that have expired.
     */
    public async countExpiredRentals(currentBlock: number, trx?: Trx): Promise<number> {
        // eslint-disable-next-line prettier/prettier
        const result = await this.queryRaw(trx).from('rental_delegations').where('status', 'active').where('expiration_block', '<=', currentBlock).count('* as count').first();
        return parseInt(result?.count as string, 10) || 0;
    }

    /**
     * Update rental delegation status (e.g., active → expired or active → cancelled).
     */
    public async updateStatus(id: string, status: RentalDelegationStatus, action: IAction, trx?: Trx): Promise<EventLog[]> {
        const result = await this.query(RentalDelegationEntity, trx).where('id', id).updateItemWithReturning({
            status,
            updated_date: action.op.block_time,
        });
        return [new EventLog(EventTypes.UPDATE, RentalDelegationEntity, result)];
    }

    /**
     * Get all active rental delegations for a given promise.
     */
    public async getByPromise(promiseType: string, promiseExtId: string, trx?: Trx): Promise<RentalDelegationEntry[]> {
        // eslint-disable-next-line prettier/prettier
        const records = await this.query(RentalDelegationEntity, trx).where('promise_type', promiseType).where('promise_ext_id', promiseExtId).getMany();
        return RentalDelegationRepository.intoMany(records);
    }

    /**
     * Get all active rentals for a lender.
     */
    public async getActiveByLender(lender: string, trx?: Trx): Promise<RentalDelegationEntry[]> {
        // eslint-disable-next-line prettier/prettier
        const records = await this.query(RentalDelegationEntity, trx).where('lender', lender).where('status', 'active').orderBy('id', 'asc').getMany();
        return RentalDelegationRepository.intoMany(records);
    }

    /**
     * Get all active rentals for a borrower.
     */
    public async getActiveByBorrower(borrower: string, trx?: Trx): Promise<RentalDelegationEntry[]> {
        // eslint-disable-next-line prettier/prettier
        const records = await this.query(RentalDelegationEntity, trx).where('borrower', borrower).where('status', 'active').orderBy('id', 'asc').getMany();
        return RentalDelegationRepository.intoMany(records);
    }

    /**
     * Get the total active rental qty delegated from a lender to a specific borrower for a given token.
     */
    public async getActiveRentalQty(lender: string, borrower: string, token: string, trx?: Trx): Promise<number> {
        const result = await this.queryRaw(trx)
            .from('rental_delegations')
            .where('lender', lender)
            .where('borrower', borrower)
            .where('token', token)
            .where('status', 'active')
            .sum('qty as total')
            .first();
        return parseFloat(result?.total as string) || 0;
    }

    /**
     * Get the total active rental qty delegated from a lender to multiple borrowers for a given token.
     */
    public async getActiveRentalQtyMulti(lender: string, borrowers: string[], token: string, trx?: Trx): Promise<Map<string, number>> {
        const results = await this.queryRaw(trx)
            .from('rental_delegations')
            .where('lender', lender)
            .whereIn('borrower', borrowers)
            .where('token', token)
            .where('status', 'active')
            .groupBy('borrower')
            .select('borrower')
            .sum('qty as total');
        const map = new Map<string, number>();
        for (const row of results) {
            map.set(row.borrower as string, parseFloat(row.total as string) || 0);
        }
        return map;
    }
}
