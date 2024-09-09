import { AdminAction, AdminMembership, EventLog, OperationData, PoolManager, Trx } from '@steem-monsters/splinterlands-validator';
import { add_pool } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class AddPoolAction extends AdminAction<typeof add_pool.actionSchema> {
    readonly #poolManager: PoolManager;
    constructor(op: OperationData, data: unknown, index: number, poolManager: PoolManager, adminMembership: AdminMembership) {
        super(adminMembership, add_pool, op, data, index);
        this.#poolManager = poolManager;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const added = await this.#poolManager.add(this.params, this, trx);
        return [added];
    }
}

const Builder = MakeActionFactory(AddPoolAction, PoolManager, AdminMembership);
export const Router = MakeRouter(add_pool.action_name, Builder);
