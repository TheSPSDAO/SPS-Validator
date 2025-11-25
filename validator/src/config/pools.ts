import { object, number, date, string, mixed } from 'yup';

export type BasePoolSettings = {
    start_block: number;
    stop_date_utc?: Date | string;
    stop_block?: number;
};

export type PoolPerBlockSettings = BasePoolSettings & {
    type?: 'per_block';
    tokens_per_block: number;
    reduction_pct?: number;
    reduction_blocks?: number;
};

export type PoolPerBlockCappedSettings = BasePoolSettings & {
    type: 'per_block_capped';
    tokens_per_block: number;
};

export type PoolSettings = PoolPerBlockSettings | PoolPerBlockCappedSettings;

const unstaking_settings_schema = object({
    unstaking_interval_seconds: number().integer().positive().required(),
    unstaking_periods: number().integer().required().positive(),
});

export type UnstakingSettings = {
    unstaking_interval_seconds: number;
    unstaking_periods: number;
};

export const UnstakingSettings = {
    validate: (value: unknown): asserts value is UnstakingSettings => unstaking_settings_schema.validateSync(value) && void 0,
};

export type UnstakingConfiguration = {
    get(token?: string): UnstakingSettings;
};

const per_block_pool_settings_schema = object({
    type: string().oneOf(['per_block', undefined]).optional(),
    tokens_per_block: number().min(0).required(),
    reduction_pct: number().min(0).max(100).optional(),
    reduction_blocks: number().positive().optional(),
    start_block: number().integer().positive().required(),
    stop_date_utc: date().optional(),
    stop_block: number().integer().positive().optional(), // Can be used directly, or can be calculated from stop_date_utc once the moment rolls over.
});

const per_block_capped_pool_settings_schema = object({
    type: string().oneOf(['per_block_capped']).required(),
    tokens_per_block: number().min(0).required(),
    start_block: number().integer().positive().required(),
    stop_date_utc: date().optional(),
    stop_block: number().integer().positive().optional(), // Can be used directly, or can be calculated from stop_date_utc once the moment rolls over.
});

const pool_settings_schema = mixed().test('is-pool-settings', 'Must be a valid PoolSettings object', (value): value is PoolSettings => {
    const schemas = [per_block_pool_settings_schema, per_block_capped_pool_settings_schema];
    return schemas.some((schema) => schema.isValidSync(value));
});

export type AwardPool<T extends string> = {
    name: T;
    reward_account: string;
    token: string;
    stake: string;
};

export type PoolProps = 'acc_tokens_per_share' | 'last_reward_block';

export type DelegatePoolProps = {
    readonly [key in PoolProps]?: number;
};

export type ValidatedPool<T extends string> = {
    [key in T]: PoolSettings;
} & {
    [key in `${T}_${PoolProps}`]: number;
};

type PoolValidator<T extends string> = (value: unknown) => asserts value is ValidatedPool<T>;

export type Pools<T extends string = string> = AwardPool<T>[];
export const Pools: unique symbol = Symbol('Pools');

export class PoolsHelper<T extends string> {
    private static readonly reservedNames = ['_acc_tokens_per_share', '_last_reward_block'];
    private readonly validators: PoolValidator<T>[];

    // Hard assumption: name is not a reserved name, and both name and token are unique!
    constructor(private readonly pools: Pools<T>) {
        if (!PoolsHelper.validateAwardPools(pools)) {
            throw new Error(`Award pools not unique, disabling`);
        }
        this.validators = pools.map(PoolsHelper.poolValidator);
    }

    public validate(value: unknown): asserts value is ValidatedPool<T> {
        if (this.validators.length === 0) {
            throw new Error('No validators available');
        }

        for (const validator of this.validators) {
            validator(value);
        }
    }

    private static validateAwardPools(pools: AwardPool<string>[]) {
        const size = pools.length;
        const uniqueNames = new Set([...pools.map((p) => p.name)]).size === size;
        const usableNames = !pools.some((p) => this.reservedNames.includes(p.name));
        return usableNames && uniqueNames;
    }

    public static asDelegate<T extends string>(pool: ValidatedPool<T>, k: T): DelegatePoolProps {
        return {
            get acc_tokens_per_share() {
                return pool[`${k}_acc_tokens_per_share`] as unknown as number | undefined;
            },
            get last_reward_block() {
                return pool[`${k}_last_reward_block`] as unknown as number | undefined;
            },
        };
    }

    private static poolValidator<T extends string>(pool: AwardPool<T>): PoolValidator<T> {
        const name = pool.name;
        const schema = object({
            [name]: pool_settings_schema,
            [`${name}_acc_tokens_per_share`]: number(),
            [`${name}_last_reward_block`]: number().integer().min(0), // 0 is not a proper block number, yet a good default for 'not-yet-paid-out'
        });
        return (value: unknown): asserts value is ValidatedPool<T> => {
            if (PoolsHelper.reservedNames.includes(name)) {
                throw new Error(`Pool name ${name} is reserved`);
            }
            schema.validateSync(value);
        };
    }

    public poolByName<N extends string>(name: N): AwardPool<N & T> | undefined {
        return <AwardPool<N & T> | undefined>this.pools.find((pool) => pool.name === <string>name);
    }

    public isPool(name: string): boolean {
        return this.pools.some((pool) => pool.name === name);
    }

    public poolByToken(token: string): AwardPool<T> | void {
        return this.pools.find((pool) => pool.token === token);
    }
}
