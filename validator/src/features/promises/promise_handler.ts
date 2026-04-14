import { Result } from '@steem-monsters/lib-monad';
import { IAction } from '../../actions';
import { PromiseEntity, PromiseStatus, Trx } from '../../db/tables';
import { EventLog } from '../../entities/event_log';

export type HandlerCreatePromiseRequest = {
    type: string;
    id: string | undefined | null;
    params: unknown;
    /**
     * The fulfill timeout seconds requested for this promise, if any.
     * Handlers can validate this value (e.g., require null for certain promise types).
     */
    fulfill_timeout_seconds?: number;
};

export type HandlerCreatePromiseResult = {
    /**
     * If true, the promise can be created by non-admin accounts (e.g. the lender directly).
     * Default: false (admin required).
     */
    allowNonAdmin?: boolean;
};

/**
 * Result returned by the handler's createPromise method.
 */
export type HandlerCreateResult = {
    logs: EventLog[];
    /**
     * If provided, these params will be stored on the promise instead of the raw request params.
     * Use this to set computed defaults (e.g. qty_remaining).
     */
    params?: unknown;
};

export type HandlerFulfillPromiseRequest = {
    type: string;
    id: string;
    metadata: unknown;
};

export type HandlerFulfillPromisesRequest = {
    type: string;
    ids: string[];
    metadata: unknown;
};

/**
 * Result returned by fulfillPromise/fulfillPromises handlers to control
 * how the PromiseManager transitions the promise state.
 */
export type HandlerFulfillPromiseResult = {
    logs: EventLog[];
    /**
     * Controls what status the promise transitions to after this fill.
     * - 'fulfilled': normal behavior (default). Promise is fully filled.
     * - 'open': partial fill — promise stays open for more fills.
     * - 'completed': promise is fully filled and done (skips fulfilled state).
     */
    status?: PromiseStatus;
    /**
     * If provided, the promise params will be updated to this value.
     * Used to track remaining quantity for partial fills.
     */
    updatedParams?: unknown;
};

export type HandlerReversePromiseRequest = {
    type: string;
    id: string;
};

export type HandlerCompletePromiseRequest = {
    type: string;
    id: string;
};

export type HandlerCancelPromiseRequest = {
    type: string;
    id: string;
};

export abstract class PromiseHandler {
    /**
     * Whether this handler requires admin privileges to create promises.
     * Override to return false for handlers that allow direct user creation.
     */
    requiresAdminForCreate(): boolean {
        return true;
    }

    /**
     * Called before any other validation to check if promise creation is allowed.
     * Override to block creation entirely under certain conditions (e.g., before a transition block).
     * Default implementation always allows creation.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    canCreate(action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        return Promise.resolve(Result.OkVoid());
    }

    abstract validateCreatePromise(request: HandlerCreatePromiseRequest, action: IAction, trx?: Trx): Promise<Result<HandlerCreatePromiseResult, Error>>;
    abstract createPromise(request: HandlerCreatePromiseRequest, action: IAction, trx?: Trx): Promise<HandlerCreateResult>;

    abstract validateFulfillPromise(request: HandlerFulfillPromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<Result<void, Error>>;
    abstract fulfillPromise(request: HandlerFulfillPromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<HandlerFulfillPromiseResult>;

    abstract validateFulfillPromises(request: HandlerFulfillPromisesRequest, promises: PromiseEntity[], action: IAction, trx?: Trx): Promise<Result<void, Error>>;
    abstract fulfillPromises(request: HandlerFulfillPromisesRequest, promises: PromiseEntity[], action: IAction, trx?: Trx): Promise<HandlerFulfillPromiseResult>;

    abstract validateReversePromise(request: HandlerReversePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<Result<void, Error>>;
    abstract reversePromise(request: HandlerReversePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<EventLog[]>;

    abstract validateCompletePromise(request: HandlerCompletePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<Result<void, Error>>;
    abstract completePromise(request: HandlerCompletePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<EventLog[]>;

    /**
     * Optional method to validate a cancel promise request.
     * When a promise is cancelled, it is first reversed, so most of the
     * time this method does not have to be implemented.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    validateCancelPromise(request: HandlerCompletePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        return Promise.resolve(Result.OkVoid());
    }

    /**
     * Optional method to cancel a promise request.
     * When a promise is cancelled, it is first reversed, so most of the
     * time this method does not have to be implemented.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    cancelPromise(request: HandlerCompletePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<EventLog[]> {
        return Promise.resolve([]);
    }

    getPromisesNotFoundErrorMessage(ids: string[]): string {
        return `Some promises not found: ${ids.join(', ')}`;
    }

    getPromisesNotOpenErrorMessage(ids: string[]): string {
        return `Some promises are not open: ${ids.join(', ')}`;
    }
}
