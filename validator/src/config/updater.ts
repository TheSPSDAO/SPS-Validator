import { Trx } from '../db/tables';
import { EventLog } from '../entities/event_log';

export interface PoolUpdater {
    updateLastRewardBlock<T extends string>(pool_name: T, block_num: number, trx?: Trx): Promise<EventLog[]>;
    updateAccTokensPerShare<T extends string>(pool_name: T, tokens_per_share: number, trx?: Trx): Promise<EventLog[]>;
    updateStopBlock<T extends string>(pool_name: T, stop_block: number, trx?: Trx): Promise<EventLog[]>;
}
export const PoolUpdater: unique symbol = Symbol('PoolUpdater');
