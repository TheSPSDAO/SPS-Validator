import { ConfigData } from '../utilities/config';
import { Trx } from '../db/tables';
import { EventLog } from '../entities/event_log';
import { array, InferType, mixed, number, object, string } from 'yup';
import type { token } from '../utilities/token_support';
import { ValidatedPool, UnstakingConfiguration } from './pools';
import { BookkeepingConfig } from '../entities/bookkeeping';
import { Result } from '@steem-monsters/lib-monad';
export * from './pools';
export * from './updater';

export type ValidatorConfig = {
    reward_start_block: number;
    tokens_per_block: number;
    paused_until_block: number;
    reward_token: token;
    min_validators: number;
    reduction_blocks: number;
    max_block_age: number;
    reduction_pct: number;
    max_votes: number;
    num_top_validators: number;
    last_checked_block: number;
};

export type TokenConfig = {
    inflation_pools?: Array<unknown>;
    token_records?: Array<unknown>;
};

type type_check<T, _W extends T> = never;

export const token_schema = object({
    inflation_pools: array().optional(),
    token_records: array().optional(),
});

// Only to assert types. Can be replaced by const discount_schema: ObjectSchema<DiscountEntry> = ...
type _sps = type_check<TokenConfig, InferType<typeof token_schema>>;

export const validator_schema = object({
    reward_start_block: number().integer().positive().required(),
    paused_until_block: number().integer().required(),
    tokens_per_block: number().min(0).required(),
    reward_token: string().strict().required(),
    min_validators: number().min(0).required(),
    reduction_blocks: number().integer().positive().required(),
    max_block_age: number().integer().positive().required(),
    reduction_pct: number().min(0).required(),
    max_votes: number().positive().required(),
    num_top_validators: number().positive().required(),
    last_checked_block: number().integer().positive().required(),
});

export interface ValidatorUpdater {
    updateLastCheckedBlock(block_num: number, trx?: Trx): Promise<EventLog[]>;
}
export const ValidatorUpdater: unique symbol = Symbol('ValidatorUpdater');

// Only to assert types. Can be replaced by const discount_schema: ObjectSchema<DiscountEntry> = ...
type _validator = type_check<ValidatorConfig, InferType<typeof validator_schema>>;

// TODO: there must be a tidier way to manage this
export type ShopConfig = {
    // sic
    validator_tranch_0: unknown;
    validator_tranch_1: unknown;
    validator_tranch_2: unknown;
    validator_tranch_3: unknown;
    validator_tranch_4: unknown;
    validator_tranch_5: unknown;
    validator_tranch_6: unknown;
    validator_tranch_7: unknown;
    [key: string]: unknown;
};

export const shop_entries_schema = object({
    validator_tranch_0: mixed().required(),
    validator_tranch_1: mixed().required(),
    validator_tranch_2: mixed().required(),
    validator_tranch_3: mixed().required(),
    validator_tranch_4: mixed().required(),
    validator_tranch_5: mixed().required(),
    validator_tranch_6: mixed().required(),
    validator_tranch_7: mixed().required(),
});

type _shop = type_check<ShopConfig, InferType<typeof shop_entries_schema>>;

export const bookkeeping_entries_schema = object({
    accounts: array().of(string().required()).required(),
});

type _bookkeeping = type_check<BookkeepingConfig, InferType<typeof bookkeeping_entries_schema>>;

// TODO: This is not okay, but TypeScript cannot guarantee that this is correct at any time.
export type ConfigType = {
    [key: string]: undefined | unknown;
};

export type ConfigUpdate = {
    group_name: string;
    name: string;
    value: undefined | unknown;
};

export type ReadOnlyWatcher<T extends string, C> = {
    readonly [key in T]?: C;
};

type PascalCase<T extends string, TSeparator extends string> = T extends `${infer L}${TSeparator}${infer R}` ? `${Capitalize<L>}${PascalCase<R, TSeparator>}` : Capitalize<T>;
// some_string -> SomeString
type WatcherName<T extends string> = PascalCase<T, '_' | '-'>;

export type Watcher<T extends string, C> = {
    [key in `add${WatcherName<T>}Watcher`]: (key: string | symbol, handler: (value?: C) => void) => void;
} & {
    [key in `remove${WatcherName<T>}Watcher`]: (key: string | symbol) => void;
} & ReadOnlyWatcher<T, C>;

export type ValidatorWatch = Watcher<'validator', ValidatorConfig>;
export const ValidatorWatch: unique symbol = Symbol('ValidatorWatch');

export type TokenWatch = Watcher<'token', TokenConfig>;
export const TokenWatch: unique symbol = Symbol('TokenWatch');

export type PoolWatch = ReadOnlyWatcher<'pools', ValidatedPool<string>>;
export const PoolWatch: unique symbol = Symbol('PoolWatch');

export type UnstakingWatch = ReadOnlyWatcher<'unstaking', UnstakingConfiguration>;
export const UnstakingWatch: unique symbol = Symbol('UnstakingWatch');

export type ShopWatch = Watcher<'shop', ShopConfig>;
export const ShopWatch: unique symbol = Symbol('ShopWatch');

export const ConfigLoader: unique symbol = Symbol('ConfigLoader');
export interface ConfigLoader {
    readonly value: ConfigType;
    load(trx?: Trx): Promise<void>;
    updateConfig(group_name: string, name: string, value: ConfigData, trx?: Trx): Promise<EventLog>;
    validateUpdateConfig(group_name: string, name: string, value: string, trx?: Trx): Promise<Result<void, string[]>>;
    reloadingUpdateConfig(group_name: string, name: string, value: string, trx?: Trx): Promise<EventLog>;
}
