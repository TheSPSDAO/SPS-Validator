import { inject, singleton } from 'tsyringe';
import {
    Cache,
    ConfigUpdate,
    Cloneable,
    Prime,
    ValidatorWatch,
    TokenWatch,
    Quark,
    TokenConfig,
    ShopWatch,
    ConfigLoader,
    ValidatorConfig,
    ShopConfig,
    ConfigType,
    ConfigRepository,
    validator_schema,
    shop_entries_schema,
    EventLog,
    Trx,
    LogLevel,
    log,
    EventTypes,
    ConfigEntity,
    ConfigData,
    AdminMembership,
    PoolWatch,
    UnstakingWatch,
    PoolsHelper,
    token_schema,
    ValidatedPool,
    PoolUpdater,
    PoolSerializer,
    AutonomousPoolConfiguration,
    UnstakingSettings,
    UnstakingConfiguration,
    BookkeepingWatch,
    bookkeeping_entries_schema,
    BookkeepingConfig,
    ValidatorUpdater,
} from '@steem-monsters/splinterlands-validator';
import { TOKENS } from './features/tokens';
import { ValidatorCheckInConfig, ValidatorCheckInWatch, validator_check_in_schema } from './features/validator/config';
import { AnySchema, ValidationError } from 'yup';
import { Result } from '@steem-monsters/lib-monad';
import { price_feed_schema, PriceFeedConfig, PriceFeedWatch } from './features/price_feed';

type Watches = ValidatorWatch & TokenWatch & PoolWatch & ShopWatch & UnstakingWatch & BookkeepingWatch & ValidatorCheckInWatch & PriceFeedWatch;

function assertNonNull<T>(v: T): asserts v is NonNullable<T> {
    if (v === undefined || v === null) {
        throw new Error(`assertNonNull called with null or undefined`);
    }
}

type Assertion<T = unknown> = (value: unknown, ...extra: unknown[]) => asserts value is T;
type ConfigAssertions = Record<string, Assertion>;
type ConfigAssertionValues<TAssertions extends ConfigAssertions> = {
    [key in keyof TAssertions]: TAssertions[key] extends Assertion<infer T> ? T : never;
};
type ConfigAsserter<TKey extends string = string, TAssertions extends ConfigAssertions = ConfigAssertions> = {
    readonly key: TKey;
    readonly assertions: TAssertions;
    readonly callback: (values: ConfigAssertionValues<TAssertions>) => void;
};

function schemaAssertion<T>(schema: AnySchema) {
    return (value: unknown): asserts value is T => {
        schema.validateSync(value);
    };
}

@singleton()
export class SpsConfigLoader
    extends Cache<ConfigType, ConfigUpdate>
    implements Cloneable<SpsConfigLoader>, Prime, Watches, ConfigLoader, AdminMembership, PoolUpdater, PoolSerializer, ValidatorUpdater
{
    // TODO: Could do with a custom validator.
    // TODO: Safe defaults for all values that are non-optional
    public static readonly DEFAULT = Object.freeze({
        validator: {
            reward_start_block: 60963785,
            paused_until_block: 0,
            last_checked_block: 60963784,
            tokens_per_block: 4.34,
            min_validators: 3,
            reduction_blocks: 864000,
            max_block_age: 100,
            reduction_pct: 1,
            max_votes: 10,
            num_top_validators: 10,
            reward_token: TOKENS.SPS,
        },
        sps: {
            unstaking_interval_seconds: 1,
            unstaking_periods: 1,
            staking_rewards_acc_tokens_per_share: 1,
            staking_rewards_last_reward_block: 1,
            staking_rewards: {
                start_block: 1,
                tokens_per_block: 1,
            },
            validator_rewards_acc_tokens_per_share: 1,
            validator_rewards_last_reward_block: 1,
            validator_rewards: {
                start_block: 1,
                tokens_per_block: 1,
            },
        },
        validator_check_in: {
            check_in_window_blocks: 300,
            check_in_interval_blocks: 28800,
            paused_until_block: 0,
        },
        price_feed: {
            interval_blocks: 200,
        },
    });

    #validator?: ValidatorConfig;
    #validator_check_in?: ValidatorCheckInConfig;
    #token?: TokenConfig;
    #unstaking?: UnstakingConfiguration;
    #pools?: ValidatedPool<string>;
    #shop?: ShopConfig;
    #bookkeeping?: BookkeepingConfig;
    #price_feed?: PriceFeedConfig;

    public get validator() {
        return this.#validator;
    }

    public get token() {
        return this.#token;
    }

    public get unstaking() {
        return this.#unstaking;
    }

    public get pools() {
        return this.#pools;
    }

    public get shop() {
        return this.#shop;
    }

    public get bookkeeping() {
        return this.#bookkeeping;
    }

    public get validator_check_in() {
        return this.#validator_check_in;
    }

    public get price_feed() {
        return this.#price_feed;
    }

    protected updateImpl(currentState: ConfigType, { group_name, name, value }: ConfigUpdate): ConfigType {
        const new_config = { ...currentState };
        if (group_name === '$root') {
            new_config[name] = value;
        } else {
            // @ts-ignore
            const new_group = { ...new_config[group_name], [name]: value };
            new_config[group_name] = new_group;
        }
        return new_config;
    }

    protected reloadImpl(currentState: ConfigType, newState: ConfigType): ConfigType {
        return { ...newState };
    }

    protected clearImpl(): ConfigType {
        // TODO: Hack
        return {};
    }

    public readonly canUpdate = true;

    public readonly size = undefined;

    private static readonly VALIDATE = Symbol('validate');

    private readonly asserters: ConfigAsserter[] = [];

    private readonly validatorWatcher: Quark<ConfigType, 'validator'>;
    private readonly validatorCheckInWatcher: Quark<ConfigType, 'validator_check_in'>;
    private readonly spsWatcher: Quark<ConfigType, 'sps'>;
    private readonly shopWatcher: Quark<ConfigType, 'shop'>;
    private readonly bookkeepingWatcher: Quark<ConfigType, 'bookkeeping'>;
    private readonly priceFeedWatcher: Quark<ConfigType, 'price_feed'>;

    public constructor(@inject(ConfigRepository) private readonly configRepository: ConfigRepository, @inject(PoolsHelper) private readonly poolsHelper: PoolsHelper<string>) {
        super({});

        // 'sps' is the group_name in the config table
        // next is the object created from all the entries under that group_name
        // we create different "domain" objects (token, unstaking settings, staking pools) from that object

        this.spsWatcher = this.addAsserterWatcher(
            'sps',
            {
                // every key in this object will validate the `sps` object, and be passed to the callback function for setting the domain object
                token: schemaAssertion<TokenConfig>(token_schema),
                unstaking: UnstakingSettings.validate,
                pools: this.poolsHelper.validate.bind(this.poolsHelper),
            },
            ({ token, unstaking, pools }) => {
                this.#token = token;
                this.#unstaking = unstaking ? { get: (_?: string) => unstaking } : undefined;
                this.#pools = pools;
            },
        );

        this.validatorWatcher = this.addAsserterWatcher(
            'validator',
            {
                validator: schemaAssertion<ValidatorConfig>(validator_schema),
            },
            ({ validator }) => {
                this.#validator = validator;
            },
        );

        this.validatorCheckInWatcher = this.addAsserterWatcher(
            'validator_check_in',
            {
                validator_check_in: schemaAssertion<ValidatorCheckInConfig>(validator_check_in_schema),
            },
            ({ validator_check_in }) => {
                this.#validator_check_in = validator_check_in;
            },
        );

        this.shopWatcher = this.addAsserterWatcher(
            'shop',
            {
                shop: schemaAssertion<ShopConfig>(shop_entries_schema),
            },
            ({ shop }) => {
                this.#shop = shop;
            },
        );

        this.bookkeepingWatcher = this.addAsserterWatcher(
            'bookkeeping',
            {
                bookkeeping: schemaAssertion<BookkeepingConfig>(bookkeeping_entries_schema),
            },
            ({ bookkeeping }) => {
                this.#bookkeeping = bookkeeping;
            },
        );

        this.priceFeedWatcher = this.addAsserterWatcher(
            'price_feed',
            {
                price_feed: schemaAssertion<PriceFeedConfig>(price_feed_schema),
            },
            ({ price_feed }) => {
                this.#price_feed = price_feed;
            },
        );
    }

    addAsserterWatcher<TKey extends string, TAssertions extends ConfigAssertions>(
        key: TKey,
        assertions: TAssertions,
        callback: (values: ConfigAssertionValues<TAssertions>) => void,
    ) {
        this.asserters.push({ key, assertions, callback } as ConfigAsserter);
        return this.quark(key).addWatch(SpsConfigLoader.VALIDATE, (previous, next) => {
            const values: Record<string, any> = {};
            for (const [k, assertion] of Object.entries(assertions)) {
                try {
                    // next/previous are reversed because we rarely use previous and its a better interface
                    const _ = assertion(next, previous);
                    values[k] = next;
                } catch (err) {
                    log(`Config validation failed for ${key}.${k}: ${err}`, LogLevel.Error);
                    values[k] = undefined;
                }
            }
            callback(values as ConfigAssertionValues<TAssertions>);
        });
    }

    store(pools: AutonomousPoolConfiguration[], trx?: Trx) {
        return this.updateConfig('sps', 'inflation_pools', pools, trx);
    }

    async updateLastRewardBlock<T extends string>(pool_name: T, block_num: number, trx?: Trx) {
        return [await this.updateConfig('sps', `${pool_name}_last_reward_block`, block_num, trx)];
    }

    async updateAccTokensPerShare<T extends string>(pool_name: T, tokens_per_share: number, trx?: Trx) {
        return [await this.updateConfig('sps', `${pool_name}_acc_tokens_per_share`, tokens_per_share, trx)];
    }

    async updateLastCheckedBlock(block_num: number, trx?: Trx): Promise<EventLog[]> {
        return [await this.updateConfig('validator', 'last_checked_block', block_num, trx)];
    }

    async updateStopBlock<T extends string>(pool_name: T, stop_block: number, trx?: Trx) {
        const p = this.pools;
        assertNonNull(p);
        const existing = p[pool_name];
        const updated = { ...existing, stop_block };
        return [await this.updateConfig('sps', pool_name, updated, trx)];
    }

    async isAdmin(account: string): Promise<boolean> {
        const adminAccounts = this.value.admin_accounts;
        return account === 'steemmonsters' || (adminAccounts && (adminAccounts as string[]).includes(account));
    }

    public addValidatorWatcher(key: string | symbol, handler: (value?: ValidatorConfig) => void) {
        this.validatorWatcher.addWatch(key, (_prev, _next) => {
            // HACK: actually assume our handler runs after the ConfigLoader.VALIDATE handler.
            handler(this.validator);
        });
    }

    addValidatorCheckInWatcher(key: string | symbol, handler: (value?: ValidatorCheckInConfig | undefined) => void) {
        this.validatorCheckInWatcher.addWatch(key, (_prev, _next) => {
            handler(this.validator_check_in);
        });
    }

    removeValidatorCheckInWatcher(key: string | symbol) {
        this.validatorCheckInWatcher.removeWatch(key);
    }

    public removeValidatorWatcher(key: string | symbol) {
        this.validatorWatcher.removeWatch(key);
    }

    public addShopWatcher(key: string | symbol, handler: (value?: ShopConfig) => void) {
        this.shopWatcher.addWatch(key, (_prev, _next) => {
            // HACK: actually assume our handler runs after the ConfigLoader.VALIDATE handler.
            handler(this.shop);
        });
    }

    public removeShopWatcher(key: string | symbol) {
        this.shopWatcher.removeWatch(key);
    }

    public addTokenWatcher(key: string | symbol, handler: (value?: TokenConfig) => void) {
        this.spsWatcher.addWatch(key, (_prev, _next) => {
            // HACK: actually assume our handler runs after the ConfigLoader.VALIDATE handler.
            handler(this.token);
        });
    }

    public removeTokenWatcher(key: string | symbol) {
        this.spsWatcher.removeWatch(key);
    }

    public addBookkeepingWatcher(key: string | symbol, handler: (value?: BookkeepingConfig) => void) {
        this.bookkeepingWatcher.addWatch(key, (_prev, _next) => {
            handler(this.bookkeeping);
        });
    }

    public removeBookkeepingWatcher(key: string | symbol) {
        this.bookkeepingWatcher.removeWatch(key);
    }

    public addPriceFeedWatcher(key: string | symbol, handler: (value?: PriceFeedConfig | undefined) => void) {
        this.priceFeedWatcher.addWatch(key, (_prev, _next) => {
            handler(this.price_feed);
        });
    }

    public removePriceFeedWatcher(key: string | symbol) {
        this.priceFeedWatcher.removeWatch(key);
    }

    async prime(trx?: Trx): Promise<void> {
        await this.load(trx);
    }

    clone(): SpsConfigLoader {
        return new SpsConfigLoader(this.configRepository, this.poolsHelper);
    }

    public async load(trx?: Trx) {
        const config_entries = await this.configRepository.load(trx);
        this.reload(config_entries);
    }

    public async validateUpdateConfig(group_name: string, name: string, value: string, trx?: Trx): Promise<Result<void, string[]>> {
        const exists = await this.configRepository.exists({ group_name, name }, trx);
        if (!exists) {
            return Result.Err([`Config entry ${group_name}.${name} does not exist.`]);
        }

        const currentConfig = this.value;
        const newConfig = await this.configRepository.testUpdate({ group_name, name, value }, trx);
        const errors: string[] = [];
        for (const asserter of this.asserters) {
            const { key: asserterKey, assertions } = asserter;
            if (asserterKey !== group_name) {
                continue;
            }

            const assertionFuncs = Object.entries(assertions);
            for (const [key, assertion] of assertionFuncs) {
                try {
                    const currentValue = currentConfig[group_name];
                    const newValue = newConfig[group_name];
                    const _ = assertion(newValue, currentValue);
                } catch (err) {
                    if (err instanceof ValidationError) {
                        errors.push(`Validation failed for ${asserterKey}.${key}: ${err.errors.join(', ')}`);
                    } else {
                        errors.push(`Validation failed for ${asserterKey}.${key}: ${err}`);
                    }
                }
            }
        }
        if (errors.length > 0) {
            return Result.Err(errors);
        }
        return Result.OkVoid();
    }

    /**
     * Updates configuration in the database.
     * Also reloads the entire configuration from the database.
     * @return a record of the updated configuration record.
     */
    public async reloadingUpdateConfig(group_name: string, name: string, value: string, trx?: Trx): Promise<EventLog> {
        const result = await this.configRepository.updateReturning({ group_name, name, value }, trx);
        if (result) {
            log(`Updated config value [${group_name}.${name}] to ${value}, reloading database.`, LogLevel.Info);
            await this.load(trx);
        }
        return new EventLog(EventTypes.UPDATE, ConfigEntity, result);
    }

    /**
     * Updates configuration stored in the database.
     * Directly writes into the config cache instead of reloading from db.
     */
    public async updateConfig(group_name: string, name: string, value: ConfigData, trx?: Trx): Promise<EventLog> {
        const unparsed_value = ConfigRepository.unparse_value(value);
        const result = await this.configRepository.updateReturning({ group_name, name, value: unparsed_value }, trx);
        log(`Updated config value [${group_name}.${name}] to ${value}, not reloading database.`, LogLevel.Info);
        this.update({ group_name, name, value });
        return new EventLog(EventTypes.UPDATE, ConfigEntity, result);
    }
}
