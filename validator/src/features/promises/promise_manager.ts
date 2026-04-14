import { Result } from '@steem-monsters/lib-monad';
import { PromiseEntity, Trx } from '../../db/tables';
import { JSONB } from '../../db/columns';
import { IAction } from '../../actions/action';
import { EventLog } from '../../entities/event_log';
import { PromiseRepository } from '../../entities/promises/promise';
import { ErrorType, ValidationError } from '../../entities/errors';
import { PromiseHandler } from './promise_handler';
import { AdminMembership } from '../../libs/acl/admin';
import { ProcessResult, VirtualPayloadSource } from '../../actions/virtual';
import { BlockRef } from '../../entities/block';
import { PrefixOpts } from '../../entities/operation';

export type CreatePromiseRequest = {
    type: string;
    /**
     * The promise ID. If null, will be auto-generated from the action context.
     * Auto-generation is only supported for specific promise types.
     */
    id: string | null;
    controllers: string[];
    fulfill_timeout_seconds?: number;
    params: unknown;
};
export type FulfillPromiseRequest = {
    type: string;
    id: string;
    metadata: unknown;
};
export type FulfillPromisesRequest = {
    type: string;
    ids: string[];
    metadata: unknown;
};
export type ReversePromiseRequest = {
    type: string;
    id: string;
};
export type CancelPromiseRequest = {
    type: string;
    id: string;
};
export type CompletePromiseRequest = {
    type: string;
    id: string;
};

export class PromiseManager implements VirtualPayloadSource {
    private static readonly EXPIRATION_ACCOUNT = '$PROMISE_EXPIRATION';

    constructor(
        private readonly handlers: Map<string, PromiseHandler>,
        private readonly cfg: PrefixOpts,
        private readonly adminMembership: AdminMembership,
        private readonly promiseRepository: PromiseRepository,
    ) {}

    async process(block: BlockRef, trx?: Trx): Promise<ProcessResult[]> {
        const expiredPromises = await this.promiseRepository.countExpiredPromises(block.block_time, trx);
        if (expiredPromises === 0) {
            return [];
        }
        return [
            [
                'custom_json',
                {
                    required_auths: [PromiseManager.EXPIRATION_ACCOUNT],
                    required_posting_auths: [],
                    id: this.cfg.custom_json_id,
                    json: {
                        action: 'expire_promises',
                        params: {
                            now: block.block_time,
                        },
                    },
                },
            ],
        ];
    }

    trx_id(block: BlockRef): string {
        return `sl_expire_promises_${block.block_num}`;
    }

    async expirePromises(now: Date, action: IAction, trx?: Trx): Promise<EventLog[]> {
        const expiredPromises = await this.promiseRepository.getExpiredPromises(now, trx);
        const eventLogs: EventLog[] = [];
        for (const promise of expiredPromises) {
            const result = await this.reversePromise({ type: promise.type, id: promise.ext_id }, action, trx);
            eventLogs.push(...result);
        }
        return eventLogs;
    }

    /**
     * Generates a deterministic unique promise ID from the action context.
     * Format: {block_num}-{transaction_id}-{index}
     */
    private generatePromiseId(action: IAction): string {
        return `${action.op.block_num}-${action.op.transaction_id}-${action.index}`;
    }

    /**
     * Resolves the promise ID, generating one if null was provided.
     */
    private resolvePromiseId(request: CreatePromiseRequest, action: IAction): string {
        return request.id ?? action.unique_trx_id;
    }

    async validateCreatePromise(request: CreatePromiseRequest, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            return Result.Err(new ValidationError('Invalid promise type', action, ErrorType.InvalidPromiseType));
        }

        // Check if creation is allowed at all for this handler (e.g., transition blocks)
        const canCreateResult = await handler.canCreate(action, trx);
        if (Result.isErr(canCreateResult)) {
            return canCreateResult;
        }

        // Run handler validation first so we can check allowNonAdmin from the result
        const handlerResult = await handler.validateCreatePromise(request, action, trx);
        if (Result.isErr(handlerResult)) {
            return handlerResult;
        }

        const promiseId = this.resolvePromiseId(request, action);
        const allowNonAdmin = handlerResult.value.allowNonAdmin ?? false;
        if (!allowNonAdmin && !(await this.adminMembership.isAdmin(action.op.account))) {
            return Result.Err(new ValidationError('Only admins can create promises', action, ErrorType.AdminOnly));
        }

        const existingPromise = await this.promiseRepository.getPromiseByTypeAndId(request.type, promiseId, trx);
        if (existingPromise) {
            return Result.Err(new ValidationError('Promise already exists', action, ErrorType.PromiseAlreadyExists));
        }

        return Result.OkVoid();
    }

    async createPromise(request: CreatePromiseRequest, action: IAction, trx?: Trx): Promise<EventLog[]> {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            throw new Error('Invalid promise type');
        }

        const promiseId = this.resolvePromiseId(request, action);
        const resolvedRequest = { ...request, id: promiseId };

        const handlerResult = await handler.createPromise(resolvedRequest, action, trx);
        const [_, insertLogs] = await this.promiseRepository.insert(
            {
                actor: action.op.account,
                type: request.type,
                ext_id: promiseId,
                controllers: request.controllers,
                params: (handlerResult.params ?? request.params) as JSONB,
                fulfill_timeout_seconds: request.fulfill_timeout_seconds ?? null,
                status: 'open',
            },
            action,
            trx,
        );

        return [...insertLogs, ...handlerResult.logs];
    }

    async validateFulfillPromise(request: FulfillPromiseRequest, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            return Result.Err(new ValidationError('Invalid promise type', action, ErrorType.InvalidPromiseType));
        }
        const promise = await this.promiseRepository.getPromiseByTypeAndId(request.type, request.id, trx);
        if (!promise) {
            return Result.Err(new ValidationError(handler.getPromisesNotFoundErrorMessage([request.id]), action, ErrorType.InvalidPromise));
        } else if (promise.status !== 'open') {
            return Result.Err(new ValidationError(handler.getPromisesNotOpenErrorMessage([request.id]), action, ErrorType.InvalidPromiseStatus));
        }

        const handlerResult = await handler.validateFulfillPromise(request, promise, action, trx);
        if (Result.isErr(handlerResult)) {
            return handlerResult;
        }

        return Result.OkVoid();
    }

    async fulfillPromise(request: FulfillPromiseRequest, action: IAction, trx?: Trx) {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            throw new Error('Invalid promise type');
        }

        const promise = (await this.promiseRepository.getPromiseByTypeAndId(request.type, request.id, trx))!;
        const handlerResult = await handler.fulfillPromise(request, promise, action, trx);
        const targetStatus = handlerResult.status ?? 'fulfilled';

        // If the handler says the promise stays open (partial fill), update params but don't change status
        if (targetStatus === 'open') {
            const [_, updateLogs] = await this.promiseRepository.update(
                {
                    action: 'fulfill',
                    previous_status: promise.status,
                    actor: action.op.account,
                    type: promise.type,
                    ext_id: promise.ext_id,
                    status: 'open',
                    fulfilled_at: null,
                    fulfilled_by: null,
                    fulfilled_expiration: null,
                },
                action,
                trx,
            );
            const paramLogs: EventLog[] = [];
            if (handlerResult.updatedParams) {
                paramLogs.push(...(await this.promiseRepository.updateParams(promise.type, promise.ext_id, handlerResult.updatedParams as JSONB, action, trx)));
            }
            return [...updateLogs, ...paramLogs, ...handlerResult.logs];
        }

        // Normal fulfill or complete transition
        const fulfillExpiration = promise.fulfill_timeout_seconds !== null ? new Date(action.op.block_time.getTime() + promise.fulfill_timeout_seconds * 1000) : null;
        const [_, updateLogs] = await this.promiseRepository.update(
            {
                // history data
                action: targetStatus === 'completed' ? 'complete' : 'fulfill',
                previous_status: promise.status,
                actor: action.op.account,
                // promise data
                type: promise.type,
                ext_id: promise.ext_id,
                status: targetStatus,
                fulfilled_at: action.op.block_time,
                fulfilled_by: action.op.account,
                fulfilled_expiration: targetStatus === 'completed' ? null : fulfillExpiration,
            },
            action,
            trx,
        );

        // Also update params if the handler provided new ones
        const paramLogs: EventLog[] = [];
        if (handlerResult.updatedParams) {
            paramLogs.push(...(await this.promiseRepository.updateParams(promise.type, promise.ext_id, handlerResult.updatedParams as JSONB, action, trx)));
        }

        return [...updateLogs, ...paramLogs, ...handlerResult.logs];
    }

    async validateFulfillPromises(request: FulfillPromisesRequest, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            return Result.Err(new ValidationError('Invalid promise type', action, ErrorType.InvalidPromiseType));
        }
        const ids = [...new Set(request.ids)];
        const promises = await this.promiseRepository.getPromisesByTypeAndIds(request.type, ids, trx);

        const notFound = ids.filter((id) => !promises.some((p) => p.ext_id === id));
        if (notFound.length > 0) {
            const errorMessage = handler.getPromisesNotFoundErrorMessage(notFound);
            return Result.Err(new ValidationError(errorMessage, action, ErrorType.InvalidPromise));
        }
        const notOpen = promises.filter((p) => p.status !== 'open').map((p) => p.ext_id);
        if (notOpen.length > 0) {
            const errorMessage = handler.getPromisesNotOpenErrorMessage(notOpen);
            return Result.Err(new ValidationError(errorMessage, action, ErrorType.InvalidPromiseStatus));
        }

        const handlerResult = await handler.validateFulfillPromises(request, promises, action, trx);
        if (Result.isErr(handlerResult)) {
            return handlerResult;
        }

        return Result.OkVoid();
    }

    async fulfillPromises(request: FulfillPromisesRequest, action: IAction, trx?: Trx) {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            throw new Error('Invalid promise type');
        }

        const ids = [...new Set(request.ids)];
        const promises = await this.promiseRepository.getPromisesByTypeAndIds(request.type, ids, trx);
        const handlerResult = await handler.fulfillPromises(request, promises, action, trx);
        const targetStatus = handlerResult.status ?? 'fulfilled';

        // If the handler says the promises stay open (partial fill), update params but don't change status
        if (targetStatus === 'open') {
            const [_, updateLogs] = await this.promiseRepository.updateMultiple(
                {
                    action: 'fulfill',
                    previous_status: 'open',
                    actor: action.op.account,
                    type: request.type,
                    ext_ids: promises.map((p) => p.ext_id),
                    status: 'open',
                    fulfilled_at: null,
                    fulfilled_by: null,
                    fulfilled_expiration: null,
                },
                action,
                trx,
            );
            if (handlerResult.updatedParams) {
                for (const promise of promises) {
                    updateLogs.push(...(await this.promiseRepository.updateParams(promise.type, promise.ext_id, handlerResult.updatedParams as JSONB, action, trx)));
                }
            }
            return [...updateLogs, ...handlerResult.logs];
        }

        // Normal fulfill/complete transition
        const groupedExpirations = promises.reduce((map, promise) => {
            const expiration = promise.fulfill_timeout_seconds !== null ? new Date(action.op.block_time.getTime() + promise.fulfill_timeout_seconds * 1000) : null;
            const group = map.get(expiration) ?? [];
            group.push(promise);
            map.set(expiration, group);
            return map;
        }, new Map<Date | null, PromiseEntity[]>());

        const updateLogs: EventLog[] = [];
        for (const [expiration, groupedPromises] of groupedExpirations) {
            const [_, groupsLogs] = await this.promiseRepository.updateMultiple(
                {
                    // history data
                    action: targetStatus === 'completed' ? 'complete' : 'fulfill',
                    previous_status: 'open',
                    actor: action.op.account,
                    // promise data
                    type: request.type,
                    ext_ids: groupedPromises.map((p) => p.ext_id),
                    status: targetStatus,
                    fulfilled_at: action.op.block_time,
                    fulfilled_by: action.op.account,
                    fulfilled_expiration: targetStatus === 'completed' ? null : expiration,
                },
                action,
                trx,
            );
            updateLogs.push(...groupsLogs);
        }

        // Also update params if the handler provided new ones
        if (handlerResult.updatedParams) {
            for (const promise of promises) {
                updateLogs.push(...(await this.promiseRepository.updateParams(promise.type, promise.ext_id, handlerResult.updatedParams as JSONB, action, trx)));
            }
        }

        return [...updateLogs, ...handlerResult.logs];
    }

    async validateReversePromise(request: ReversePromiseRequest, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            return Result.Err(new ValidationError('Invalid promise type', action, ErrorType.InvalidPromiseType));
        }
        const promise = await this.promiseRepository.getPromiseByTypeAndId(request.type, request.id, trx);
        if (!promise) {
            return Result.Err(new ValidationError('Promise not found', action, ErrorType.InvalidPromise));
        } else if (promise.status !== 'fulfilled') {
            return Result.Err(new ValidationError('Promise is not fulfilled', action, ErrorType.InvalidPromiseStatus));
        }

        const handlerResult = await handler.validateReversePromise(request, promise, action, trx);
        if (Result.isErr(handlerResult)) {
            return handlerResult;
        }

        return Result.OkVoid();
    }

    async reversePromise(request: ReversePromiseRequest, action: IAction, trx?: Trx) {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            throw new Error('Invalid promise type');
        }

        const promise = (await this.promiseRepository.getPromiseByTypeAndId(request.type, request.id, trx))!;
        const handlerLogs = await handler.reversePromise(request, promise, action, trx);
        const [_, updateLogs] = await this.promiseRepository.update(
            {
                // history data
                action: 'reverse',
                previous_status: promise.status,
                actor: action.op.account,
                // promise data
                type: promise.type,
                ext_id: promise.ext_id,
                status: 'open',
                fulfilled_at: null,
                fulfilled_by: null,
                fulfilled_expiration: null,
            },
            action,
            trx,
        );

        return [...updateLogs, ...handlerLogs];
    }

    async validateCancelPromise(request: CancelPromiseRequest, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            return Result.Err(new ValidationError('Invalid promise type', action, ErrorType.InvalidPromiseType));
        }
        const promise = await this.promiseRepository.getPromiseByTypeAndId(request.type, request.id, trx);
        if (!promise) {
            return Result.Err(new ValidationError('Promise not found', action, ErrorType.InvalidPromise));
        } else if (promise.status !== 'open' && promise.status !== 'fulfilled') {
            return Result.Err(new ValidationError('Promise is not open', action, ErrorType.InvalidPromiseStatus));
        }

        const handlerResult = await handler.validateCancelPromise(request, promise, action, trx);
        if (Result.isErr(handlerResult)) {
            return handlerResult;
        }

        return Result.OkVoid();
    }

    async cancelPromise(request: CancelPromiseRequest, action: IAction, trx?: Trx) {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            throw new Error('Invalid promise type');
        }

        const promise = (await this.promiseRepository.getPromiseByTypeAndId(request.type, request.id, trx))!;
        const handlerLogs: EventLog[] = [];
        if (promise.status === 'fulfilled') {
            handlerLogs.push(...(await handler.reversePromise({ type: request.type, id: request.id }, promise, action, trx)));
        }
        handlerLogs.push(...(await handler.cancelPromise(request, promise, action, trx)));
        const [_, updateLogs] = await this.promiseRepository.update(
            {
                // history data
                action: 'cancel',
                previous_status: promise.status,
                actor: action.op.account,
                // promise data
                type: promise.type,
                ext_id: promise.ext_id,
                status: 'cancelled',
                fulfilled_at: null,
                fulfilled_by: null,
                fulfilled_expiration: null,
            },
            action,
            trx,
        );

        return [...updateLogs, ...handlerLogs];
    }

    async validateCompletePromise(request: CompletePromiseRequest, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            return Result.Err(new ValidationError('Invalid promise type', action, ErrorType.InvalidPromiseType));
        }
        const promise = await this.promiseRepository.getPromiseByTypeAndId(request.type, request.id, trx);
        if (!promise) {
            return Result.Err(new ValidationError('Promise not found', action, ErrorType.InvalidPromise));
        } else if (promise.status !== 'fulfilled') {
            return Result.Err(new ValidationError('Promise is not fulfilled', action, ErrorType.InvalidPromiseStatus));
        }

        const handlerResult = await handler.validateCompletePromise(request, promise, action, trx);
        if (Result.isErr(handlerResult)) {
            return handlerResult;
        }

        return Result.OkVoid();
    }

    async completePromise(request: CompletePromiseRequest, action: IAction, trx?: Trx) {
        const handler = this.handlers.get(request.type);
        if (!handler) {
            throw new Error('Invalid promise type');
        }

        const promise = (await this.promiseRepository.getPromiseByTypeAndId(request.type, request.id, trx))!;
        const handlerLogs = await handler.completePromise(request, promise, action, trx);
        const [_, updateLogs] = await this.promiseRepository.update(
            {
                // history data
                action: 'complete',
                previous_status: promise.status,
                actor: action.op.account,
                // promise data
                type: promise.type,
                ext_id: promise.ext_id,
                status: 'completed',
                fulfilled_at: action.op.block_time,
                fulfilled_by: action.op.account,
                fulfilled_expiration: null,
            },
            action,
            trx,
        );

        return [...updateLogs, ...handlerLogs];
    }
}
