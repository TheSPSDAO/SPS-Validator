import { OperationData, PoolManager, AdminMembership, AdminAction, Trx, EventLog } from '@steem-monsters/splinterlands-validator';
import { update_pool } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class UpdatePoolAction extends AdminAction<typeof update_pool.actionSchema> {
    readonly #poolManager: PoolManager;
    constructor(op: OperationData, data: unknown, index: number, poolManager: PoolManager, adminMembership: AdminMembership) {
        super(adminMembership, update_pool, op, data, index);
        this.#poolManager = poolManager;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const update = await this.#poolManager.update(this.params, this, trx);
        return [update];
    }
}

const Builder = MakeActionFactory(UpdatePoolAction, PoolManager, AdminMembership);
export const Router = MakeRouter(update_pool.action_name, Builder);
