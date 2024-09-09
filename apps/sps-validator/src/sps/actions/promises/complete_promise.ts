import { OperationData, PromiseManager, Action, EventLog, Trx } from '@steem-monsters/splinterlands-validator';
import { complete_promise } from '../schema';
import { Result } from '@steem-monsters/lib-monad';
import { MakeActionFactory, MakeRouter } from '../utils';

export class CompletePromiseAction extends Action<typeof complete_promise.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly promiseManager: PromiseManager) {
        super(complete_promise, op, data, index);
    }

    async validate(trx?: Trx): Promise<boolean> {
        const validateResult = await this.promiseManager.validateCompletePromise(
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
        return this.promiseManager.completePromise(
            {
                type: this.params.type,
                id: this.params.id,
            },
            this,
            trx,
        );
    }
}

const Builder = MakeActionFactory(CompletePromiseAction, PromiseManager);
export const Router = MakeRouter(complete_promise.action_name, Builder);
