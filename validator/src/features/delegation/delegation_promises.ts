/* eslint-disable @typescript-eslint/no-unused-vars */
import { Result } from '@steem-monsters/lib-monad';
import { PromiseEntity, Trx } from '../../db/tables';
import { IAction } from '../../actions';
import { EventLog } from '../../entities/event_log';
import {
    HandlerCompletePromiseRequest,
    HandlerCreatePromiseRequest,
    HandlerFulfillPromiseRequest,
    HandlerFulfillPromisesRequest,
    PromiseHandler,
    HandlerReversePromiseRequest,
    HandlerCreatePromiseResult,
} from '../promises';
import { DelegationManager } from './delegation_manager';
import { ErrorType, ValidationError } from '../../entities/errors';
import { object } from 'yup';
import { token, qty, hiveUsernameOrSystemAccount, hiveAccount } from '../../actions/schema';

export type DelgationPromiseHandlerOpts = {
    delegation_promise_account: string;
};

const delegation_promise_params_schema = object({
    token: token,
    to: hiveUsernameOrSystemAccount.required(),
    qty: qty.positive(),
    player: hiveAccount.optional(),
});

export type DelegationPromiseParams = typeof delegation_promise_params_schema['__outputType'];

/**
 * This handler is used to create promises that delegate tokens to another account. The flow is:
 *
 * 1. Create a promise with the delegation parameters (the token, the quantity, and the account to delegate to)
 * 2. An account fulfills the promise, which delegates the tokens to the delegation account
 * 3. When the promise is completed, the tokens are undelegated from the delegation promise account and sent to the to account from when the promise was created.
 *      - note: the delegation cooldown isn't applied to the promise account, so the tokens are immediately available to be delegated again.
 * 4. If the promise is reversed, the tokens are undelegated from the delegation promise account and sent back to the account that fulfilled the promise.
 */
export class DelegationPromiseHandler extends PromiseHandler {
    constructor(private readonly opts: DelgationPromiseHandlerOpts, private readonly delegationManager: DelegationManager) {
        super();
    }

    override async validateCreatePromise(request: HandlerCreatePromiseRequest, action: IAction, trx?: Trx): Promise<Result<HandlerCreatePromiseResult, Error>> {
        const params = request.params as DelegationPromiseParams;
        if (params.player != null) {
            return Result.Err(new ValidationError('player parameter cannot be used in delegation promises.', action, ErrorType.DelegationAuthorityNotAllowed));
        }

        const delegationValid = await this.delegationManager.validateDelegationPromise(params, action, trx);
        if (Result.isErr(delegationValid)) {
            return Result.Err(delegationValid.error);
        }

        return Result.Ok({ params });
    }

    override createPromise(request: HandlerCreatePromiseRequest, action: IAction, trx?: Trx): Promise<EventLog<any>[]> {
        return Promise.resolve([]);
    }

    override async validateFulfillPromise(request: HandlerFulfillPromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        const paramsValid = delegation_promise_params_schema.isValidSync(promise.params);
        if (!paramsValid) {
            return Result.Err(new ValidationError('Invalid fill delegation promise parameters.', action, ErrorType.InvalidPromiseParams));
        }

        // the params on the promise have already been validated, so we can trust the payload here.
        const params = promise.params as DelegationPromiseParams;
        if (params.player) {
            return Result.Err(new ValidationError('player parameter cannot be used in delegation promises.', action, ErrorType.DelegationAuthorityNotAllowed));
        }

        // TODO could support authority with the metadata parameter
        const delegationValid = await this.delegationManager.validateDelegation(
            {
                // TODO set to to system account? fulfilling doesn't go to the promise "holder" yet
                ...params,
                from: action.op.account,
                allowSystemAccounts: false,
            },
            action,
            trx,
        );
        if (Result.isErr(delegationValid)) {
            return Result.Err(delegationValid.error);
        }

        return Result.OkVoid();
    }

    override async fulfillPromise(request: HandlerFulfillPromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<EventLog<any>[]> {
        const params = promise.params as DelegationPromiseParams;
        const logs = await this.delegationManager.delegate(
            {
                ...params,
                to: this.opts.delegation_promise_account,
                from: action.op.account,
                allowSystemAccounts: true,
            },
            action,
            trx,
        );
        return logs;
    }

    override async validateFulfillPromises(request: HandlerFulfillPromisesRequest, promises: PromiseEntity[], action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        // the params on the promise have already been validated, so we can trust the payload here.
        const promiseParams = promises.map((promise) => promise.params as DelegationPromiseParams);
        const allSameToken = promiseParams.every((params) => params.token === promiseParams[0].token);
        if (!allSameToken) {
            return Result.Err(new ValidationError('All delegation bids must be for the same token.', action, ErrorType.DelegationPromiseTokenMismatch));
        }

        // TODO could support authority with the metadata parameter
        const delegationValid = await this.delegationManager.validateDelegationMulti(
            {
                from: action.op.account,
                token: promiseParams[0].token,
                to: promiseParams.map((params) => [this.opts.delegation_promise_account, params.qty]),
                allowSystemAccounts: true,
            },
            action,
            trx,
        );
        if (Result.isErr(delegationValid)) {
            return Result.Err(delegationValid.error);
        }

        return Result.OkVoid();
    }

    override async fulfillPromises(request: HandlerFulfillPromisesRequest, promises: PromiseEntity[], action: IAction, trx?: Trx): Promise<EventLog<any>[]> {
        const promiseParams = promises.map((promise) => promise.params as DelegationPromiseParams);
        const eventLogs: EventLog[] = [];
        for (const params of promiseParams) {
            eventLogs.push(
                ...(await this.delegationManager.delegate(
                    {
                        ...params,
                        to: this.opts.delegation_promise_account,
                        from: action.op.account,
                        allowSystemAccounts: true,
                    },
                    action,
                    trx,
                )),
            );
        }
        return eventLogs;
    }

    override validateReversePromise(request: HandlerReversePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        return Promise.resolve(Result.OkVoid());
    }

    override reversePromise(request: HandlerReversePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<EventLog<any>[]> {
        const params = promise.params as DelegationPromiseParams;
        return this.delegationManager.undelegate(
            {
                ...params,
                account: promise.fulfilled_by!,
                to: promise.fulfilled_by!,
                from: this.opts.delegation_promise_account,
                allowSystemAccounts: true,
            },
            action,
            trx,
        );
    }

    override validateCompletePromise(request: HandlerCompletePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<Result<void, Error>> {
        return Promise.resolve(Result.OkVoid());
    }

    override async completePromise(request: HandlerCompletePromiseRequest, promise: PromiseEntity, action: IAction, trx?: Trx): Promise<EventLog<any>[]> {
        const params = promise.params as DelegationPromiseParams;
        // undelegate (reverse) the promise first
        const undelegateLogs = await this.delegationManager.undelegate(
            {
                ...params,
                account: promise.fulfilled_by!,
                to: promise.fulfilled_by!,
                from: this.opts.delegation_promise_account,
                allowSystemAccounts: true,
            },
            action,
            trx,
        );
        // delegate the tokens to the promise "holder"
        const delegateLogs = await this.delegationManager.delegate(
            {
                ...params,
                from: promise.fulfilled_by!,
                allowSystemAccounts: false,
            },
            action,
            trx,
        );
        return [...undelegateLogs, ...delegateLogs];
    }

    override getPromisesNotFoundErrorMessage(ids: string[]): string {
        return `Delegation bids with ids [${ids.join(', ')}] not found.`;
    }

    override getPromisesNotOpenErrorMessage(ids: string[]): string {
        return `Delegation bids with ids [${ids.join(', ')}] are not open.`;
    }
}
