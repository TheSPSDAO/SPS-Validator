import { OperationData, PromiseManager, Action, EventLog, Trx } from '@steem-monsters/splinterlands-validator';
import { cancel_promise } from '../schema';
import { Result } from '@steem-monsters/lib-monad';
import { MakeActionFactory, MakeRouter } from '../utils';

export class CancelPromiseAction extends Action<typeof cancel_promise.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly promiseManager: PromiseManager) {
        super(cancel_promise, op, data, index);
    }

    async validate(trx?: Trx): Promise<boolean> {
        const validateResult = await this.promiseManager.validateCancelPromise(
            {
                type: this.params.type,
                id: this.params.id,
            },
            this,
            trx,
        );

        if (Result.isErr(validateResult)) {
            throw validateResult.error;
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return this.promiseManager.cancelPromise(
            {
                type: this.params.type,
                id: this.params.id,
            },
            this,
            trx,
        );
    }
}

const Builder = MakeActionFactory(CancelPromiseAction, PromiseManager);
export const Router = MakeRouter(cancel_promise.action_name, Builder);
