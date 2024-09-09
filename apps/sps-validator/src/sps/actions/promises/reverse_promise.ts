import { Result } from '@steem-monsters/lib-monad';
import { OperationData, PromiseManager, Action, EventLog, Trx } from '@steem-monsters/splinterlands-validator';
import { reverse_promise } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class ReversePromiseAction extends Action<typeof reverse_promise.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly promiseManager: PromiseManager) {
        super(reverse_promise, op, data, index);
    }

    async validate(trx?: Trx): Promise<boolean> {
        const validateResult = await this.promiseManager.validateReversePromise(
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
        return this.promiseManager.reversePromise(
            {
                type: this.params.type,
                id: this.params.id,
            },
            this,
            trx,
        );
    }
}

const Builder = MakeActionFactory(ReversePromiseAction, PromiseManager);
export const Router = MakeRouter(reverse_promise.action_name, Builder);
