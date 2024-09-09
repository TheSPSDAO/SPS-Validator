import { Action, EventLog, OperationData, PoolManager, Trx } from '@steem-monsters/splinterlands-validator';
import { claim_pool } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class ClaimPoolAction extends Action<typeof claim_pool.actionSchema> {
    readonly #poolManager: PoolManager;
    constructor(op: OperationData, data: unknown, index: number, poolManager: PoolManager) {
        super(claim_pool, op, data, index);
        this.#poolManager = poolManager;
    }

    async validate(_trx?: Trx) {
        return true;
    }

    process(trx?: Trx): Promise<EventLog[]> {
        // Assume this.params.now comes from a deterministic source, such as block time
        return this.#poolManager.payout(this.params.now, this, trx);
    }
}

const Builder = MakeActionFactory(ClaimPoolAction, PoolManager);
export const Router = MakeRouter(claim_pool.action_name, Builder);
