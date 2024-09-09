import { OperationData, PromiseManager, Action, EventLog, Trx } from '@steem-monsters/splinterlands-validator';
import { expire_promises } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class ExpirePromisesAction extends Action<typeof expire_promises.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly promiseManager: PromiseManager) {
        super(expire_promises, op, data, index);
    }

    async validate(): Promise<boolean> {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return this.promiseManager.expirePromises(this.params.now, this, trx);
    }
}

const Builder = MakeActionFactory(ExpirePromisesAction, PromiseManager);
export const Router = MakeRouter(expire_promises.action_name, Builder);
