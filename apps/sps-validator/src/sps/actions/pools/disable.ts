import { OperationData, PoolManager, AdminMembership, AdminAction, EventLog, Trx } from '@steem-monsters/splinterlands-validator';
import { disable_pool } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class DisablePoolAction extends AdminAction<typeof disable_pool.actionSchema> {
    readonly #poolManager: PoolManager;

    private static readonly maxDate = new Date(8_640_000_000_000_000);

    constructor(op: OperationData, data: unknown, index: number, poolManager: PoolManager, adminMembership: AdminMembership) {
        super(adminMembership, disable_pool, op, data, index);
        this.#poolManager = poolManager;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const payload = { name: this.params.name, start: DisablePoolAction.maxDate };
        const update = await this.#poolManager.update(payload, this, trx);
        return [update];
    }
}

const Builder = MakeActionFactory(DisablePoolAction, PoolManager, AdminMembership);
export const Router = MakeRouter(disable_pool.action_name, Builder);
