import { Result } from '@steem-monsters/lib-monad';
import { IAction } from '../../actions';
import { PromiseEntity, Trx } from '../../db/tables';
import { EventLog } from '../../entities/event_log';

export type HandlerCreatePromiseRequest = {
    type: string;
    id: string;
    params: unknown;
};

export type HandlerCreatePromiseResult = {
    /**
     * the validation process can set defaults on the params. they can be returned here
     * and they will be stored
     */
    params: unknown;
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
    abstract validateCreatePromise(request: HandlerCreatePromiseRequest, action: IAction, trx?: Trx): Promise<Result<HandlerCreatePromiseResult, Error>>;
    abstract createPromise(request: HandlerCreatePromiseRequest, action: IAction, trx?: Trx): Promise<EventLog[]>;

    abstract validateFulfillPromise(request: HandlerFulfillPromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<Result<void, Error>>;
    abstract fulfillPromise(request: HandlerFulfillPromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<EventLog[]>;

    abstract validateFulfillPromises(request: HandlerFulfillPromisesRequest, promises: PromiseEntity[], action: IAction, trx?: Trx): Promise<Result<void, Error>>;
    abstract fulfillPromises(request: HandlerFulfillPromisesRequest, promises: PromiseEntity[], action: IAction, trx?: Trx): Promise<EventLog[]>;

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
