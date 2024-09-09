import { Trx } from '../db/tables';

/**
 * A 'trait' that implies that something can create clones of itself;
 * These clones must have no state sharing, but may re-use injected attributes such as repositories.
 */
export interface Cloneable<T extends Cloneable<T>> {
    clone(): T;
}

/**
 * A 'trait' that implies that something can be primed from persisted data in the database.
 */
export interface Prime {
    prime(trx?: Trx): Promise<void>;
}
