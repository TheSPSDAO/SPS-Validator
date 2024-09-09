import { IAction } from '../../actions/action';
import { EventLog, EventTypes } from '../../entities/event_log';
import { BaseRepository, Handle, PromiseAction, PromiseEntity, PromiseHistoryEntity, PromiseStatus, Trx } from '../../db/tables';

export type PromiseInsert = Omit<PromiseEntity, 'id' | 'created_date' | 'updated_date' | 'fulfilled_by' | 'fulfilled_at' | 'fulfilled_expiration'> & {
    actor: string;
};

export type PromiseUpdate = Pick<PromiseEntity, 'ext_id' | 'type' | 'status' | 'fulfilled_at' | 'fulfilled_by' | 'fulfilled_expiration'> & {
    action: PromiseAction;
    previous_status: PromiseStatus;
    actor: string;
};

export type PromiseMultiUpdate = Pick<PromiseEntity, 'type' | 'status' | 'fulfilled_at' | 'fulfilled_by' | 'fulfilled_expiration'> & {
    ext_ids: string[];
    action: PromiseAction;
    previous_status: PromiseStatus;
    actor: string;
};

export class PromiseRepository extends BaseRepository {
    constructor(handle: Handle) {
        super(handle);
    }

    async getPromiseByTypeAndId(type: string, id: string, trx?: Trx): Promise<PromiseEntity | null> {
        const result = await this.query(PromiseEntity, trx).where('type', type).where('ext_id', id).getSingleOrNull();
        return result;
    }

    async getPromisesByTypeAndIds(type: string, ids: string[], trx?: Trx): Promise<PromiseEntity[]> {
        const result = await this.query(PromiseEntity, trx).where('type', type).whereIn('ext_id', ids).getMany();
        return result;
    }

    async getExpiredPromises(now: Date, trx?: Trx): Promise<PromiseEntity[]> {
        const result = await this.query(PromiseEntity, trx).where('status', 'fulfilled').where('fulfilled_expiration', '<=', now).getMany();
        return result;
    }

    async insert(promise: PromiseInsert, action: IAction, trx?: Trx): Promise<[PromiseEntity, EventLog[]]> {
        const insertedPromise = await this.query(PromiseEntity, trx).insertItemWithReturning({
            type: promise.type,
            ext_id: promise.ext_id,
            params: promise.params,
            status: promise.status,
            controllers: promise.controllers,
            fulfill_timeout_seconds: promise.fulfill_timeout_seconds,
            created_date: action.op.block_time,
            updated_date: action.op.block_time,
        });

        const historyLogs = await this.insertHistory([insertedPromise], { actor: promise.actor, action: 'create' }, action, trx);
        const logEntity = {
            ...insertedPromise,
            id: undefined,
        };
        const eventLogs = [new EventLog(EventTypes.INSERT, PromiseEntity, logEntity), ...historyLogs];

        return [insertedPromise, eventLogs];
    }

    async update(promise: PromiseUpdate, action: IAction, trx?: Trx): Promise<[PromiseEntity, EventLog[]]> {
        const updatedPromise = await this.query(PromiseEntity, trx).where('type', promise.type).where('ext_id', promise.ext_id).updateItemWithReturning({
            status: promise.status,
            fulfilled_at: promise.fulfilled_at,
            fulfilled_by: promise.fulfilled_by,
            fulfilled_expiration: promise.fulfilled_expiration,
            updated_date: action.op.block_time,
        });

        const historyLogs = await this.insertHistory([updatedPromise], { actor: promise.actor, action: promise.action, previous_status: promise.previous_status }, action, trx);
        const logEntity = {
            ...updatedPromise,
            id: undefined,
        };
        const eventLogs = [new EventLog(EventTypes.UPDATE, PromiseEntity, logEntity), ...historyLogs];

        return [updatedPromise, eventLogs];
    }

    async updateMultiple(update: PromiseMultiUpdate, action: IAction, trx?: Trx): Promise<[PromiseEntity[], EventLog[]]> {
        const updatedPromises = await this.query(PromiseEntity, trx)
            .where('type', update.type)
            .whereIn('ext_id', update.ext_ids)
            .useKnexQueryBuilder((qb) =>
                qb
                    .update({
                        status: update.status,
                        fulfilled_at: update.fulfilled_at,
                        fulfilled_by: update.fulfilled_by,
                        fulfilled_expiration: update.fulfilled_expiration,
                        updated_date: action.op.block_time,
                    })
                    .returning('*'),
            )
            .getMany();

        const historyLogs = await this.insertHistory(updatedPromises, { actor: update.actor, action: update.action, previous_status: update.previous_status }, action, trx);
        const updateLogs = updatedPromises.map((p) => new EventLog(EventTypes.UPDATE, PromiseEntity, { ...p, id: undefined }));
        const eventLogs = [...updateLogs, ...historyLogs];

        return [updatedPromises, eventLogs];
    }

    private async insertHistory(
        promises: PromiseEntity[],
        meta: { previous_status?: PromiseStatus; actor: string; action: PromiseAction },
        action: IAction,
        trx?: Trx,
    ): Promise<EventLog[]> {
        const historyEntities: Omit<PromiseHistoryEntity, 'id'>[] = promises.map((promise) => ({
            promise_id: promise.id,
            player: meta.actor,
            action: meta.action,
            previous_status: meta.previous_status ?? null,
            new_status: promise.status,
            trx_id: action.unique_trx_id,
            created_date: action.op.block_time,
        }));
        const inserted = await this.query(PromiseHistoryEntity, trx)
            .useKnexQueryBuilder((qb) => qb.insert(historyEntities).returning('*'))
            .getMany();

        // don't expose internal ids in logs.
        const eventLogs = inserted.map((h) => {
            const promise = promises.find((p) => p.id === h.promise_id)!;
            return {
                type: promise.type,
                ext_id: promise.ext_id,
                player: h.player,
                action: h.action,
                previous_status: h.previous_status,
                new_status: h.new_status,
                trx_id: h.trx_id,
                created_date: h.created_date,
            };
        });

        return eventLogs.map((log) => new EventLog(EventTypes.INSERT, PromiseHistoryEntity, log));
    }
}
