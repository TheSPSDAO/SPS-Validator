import { Result } from '@steem-monsters/lib-monad';
import { OperationData, PromiseManager, Action, EventLog, Trx } from '@steem-monsters/splinterlands-validator';
import { fulfill_promise } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class FulfillPromiseAction extends Action<typeof fulfill_promise.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly promiseManager: PromiseManager) {
        super(fulfill_promise, op, data, index);
    }

    async validate(trx?: Trx): Promise<boolean> {
        const validateResult = await this.promiseManager.validateFulfillPromise(
            {
                type: this.params.type,
                id: this.params.id,
                metadata: this.params.metadata,
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
        return this.promiseManager.fulfillPromise(
            {
                type: this.params.type,
                id: this.params.id,
                metadata: this.params.metadata,
            },
            this,
            trx,
        );
    }
}

const Builder = MakeActionFactory(FulfillPromiseAction, PromiseManager);
export const Router = MakeRouter(fulfill_promise.action_name, Builder);
