import { Result } from '@steem-monsters/lib-monad';
import { OperationData, PromiseManager, Action, EventLog, Trx } from '@steem-monsters/splinterlands-validator';
import { fulfill_promise_multi } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
export class FulfillPromisesAction extends Action<typeof fulfill_promise_multi.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly promiseManager: PromiseManager) {
        super(fulfill_promise_multi, op, data, index);
    }

    async validate(trx?: Trx): Promise<boolean> {
        const validateResult = await this.promiseManager.validateFulfillPromises(
            {
                type: this.params.type,
                ids: this.params.ids,
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
        return this.promiseManager.fulfillPromises(
            {
                type: this.params.type,
                ids: this.params.ids,
                metadata: this.params.metadata,
            },
            this,
            trx,
        );
    }
}

const Builder = MakeActionFactory(FulfillPromisesAction, PromiseManager);
export const Router = MakeRouter(fulfill_promise_multi.action_name, Builder);
