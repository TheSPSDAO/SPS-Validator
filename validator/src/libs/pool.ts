import { array, date, InferType, number, object, string } from 'yup';
import { ActionIdentifier, ErrorType, ValidationError } from '../entities/errors';

export class AutonomousPoolError<Value extends ErrorType> extends ValidationError<Value> {}

export type AutonomousPoolConfiguration = {
    name: string;
    token: string;
    beneficiary: string; // TODO: Any hive or system account?
    tokensPerNormalizedDay: number; // TODO: A normalized day is 24 * 3600 seconds
    start: Date | string;
    lastPayout?: Date | string;
};

type PoolKey = AutonomousPoolConfiguration['name'];

export const autonomous_pool_schema = object({
    name: string().strict().required(),
    token: string().strict().required(),
    beneficiary: string().strict().required(),
    tokensPerNormalizedDay: number().min(0).lessThan(Infinity).required(),
    start: date().required(),
    lastPayout: date().optional(),
});

const array_schema = array().of(autonomous_pool_schema).required();

type type_check<T, _W extends T> = never;
type _autonomous = type_check<AutonomousPoolConfiguration, InferType<typeof autonomous_pool_schema>>;

export class AutonomousPoolsWrapper {
    readonly #pools: Map<PoolKey, AutonomousPoolConfiguration>;

    private constructor(pools: Map<PoolKey, AutonomousPoolConfiguration>) {
        this.#pools = pools;
    }

    public static create(pools: unknown): AutonomousPoolsWrapper | undefined {
        if (array_schema.isValidSync(pools)) {
            const names = pools.map((pool) => pool.name);
            const uniqueNames = names.length === new Set(names).size;
            if (!uniqueNames) {
                return undefined;
            }
            const m = new Map<PoolKey, AutonomousPoolConfiguration>();
            for (const pool of pools) {
                m.set(pool.name, pool);
            }

            return new AutonomousPoolsWrapper(m);
        }
        return undefined;
    }

    public getPool(name: PoolKey): AutonomousPoolConfiguration | undefined {
        if (!this.#pools.has(name)) {
            return undefined;
        }

        return this.#pools.get(name);
    }

    public serialize() {
        return [...this.#pools.values()];
    }

    private storePool(pool: AutonomousPoolConfiguration) {
        this.#pools.set(pool.name, pool);
    }

    public addPool(pool: AutonomousPoolConfiguration, aid: ActionIdentifier) {
        const { name } = pool;
        if (this.#pools.has(name)) {
            throw new AutonomousPoolError(`Trying to add pool with name ${name} that already is registered`, aid, ErrorType.AutonomousPoolAlreadyRegistered);
        } else if (!autonomous_pool_schema.isValidSync(pool)) {
            throw new AutonomousPoolError(`Trying to add pool with name ${name} that does not validate according to schema`, aid, ErrorType.AutonomousPoolInvalid);
        }

        this.storePool(pool);
    }

    public updatePool(pool: Partial<AutonomousPoolConfiguration>, aid: ActionIdentifier) {
        const { name } = pool;
        if (name === undefined) {
            throw new AutonomousPoolError(`Trying to update pool without name`, aid, ErrorType.AutonomousPoolWithoutName);
        } else if (!this.#pools.has(name)) {
            throw new AutonomousPoolError(`Trying to update pool with name ${pool.name} that has not been registered yet`, aid, ErrorType.AutonomousPoolNotRegistered);
        }
        const existing = this.#pools.get(name);
        const updated = { ...existing, ...pool };

        if (!autonomous_pool_schema.isValidSync(updated)) {
            throw new AutonomousPoolError(`Trying to update pool with name ${name} that does not validate according to schema.`, aid, ErrorType.AutonomousPoolInvalid);
        }
        this.storePool(updated);
    }

    async poolCallback(callback: (pool: AutonomousPoolConfiguration) => Promise<void> | void) {
        for (const pool of this.#pools.values()) {
            await callback(pool);
        }
    }
}

type Payout = {
    beneficiary: string;
    token: string;
    amount: number;
};

// TODO: clamping specification; what is the tiniest payout we will ever consider doing?
export function determinePayout(pool: AutonomousPoolConfiguration, now: Date): Payout | undefined {
    const start = new Date(pool.start);
    if (start > now) {
        // Pool hasn't started yet, or was scheduled for the future via an update.
        return undefined;
    }
    const previous = new Date(pool.lastPayout ?? pool.start);
    const mostRecent = start < previous ? previous : start;
    const diff = now.getTime() - mostRecent.getTime();
    if (diff <= 0) {
        // Really shouldn't happen, but this is not the time nor place to deal with this.
        return undefined;
    }
    const normalizedTime = 3600 * 24 * 1000; // milliseconds in the most default day imaginable;
    return {
        beneficiary: pool.beneficiary,
        token: pool.token,
        amount: (pool.tokensPerNormalizedDay * diff) / normalizedTime,
    };
}
