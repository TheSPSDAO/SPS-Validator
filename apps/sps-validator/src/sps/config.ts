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
import { ValidatorCheckInConfig, ValidatorCheckInWatch, validator_check_in_schema } from './features/validator/validator_license.config';

type Watches = ValidatorWatch & TokenWatch & PoolWatch & ShopWatch & UnstakingWatch & BookkeepingWatch & ValidatorCheckInWatch;

function assertNonNull<T>(v: T): asserts v is NonNullable<T> {
    if (v === undefined || v === null) {
        throw new Error(`assertNonNull called with null or undefined`);
    }
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
        },
    });

    #validator?: ValidatorConfig;
    #validator_check_in?: ValidatorCheckInConfig;
    #token?: TokenConfig;
    #unstaking?: UnstakingConfiguration;
    #pools?: ValidatedPool<string>;
    #shop?: ShopConfig;
    #bookkeeping?: BookkeepingConfig;

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

    private readonly validatorWatcher: Quark<ConfigType, 'validator'>;
    private readonly validatorCheckInWatcher: Quark<ConfigType, 'validator_check_in'>;
    private readonly spsWatcher: Quark<ConfigType, 'sps'>;
    private readonly shopWatcher: Quark<ConfigType, 'shop'>;
    private readonly bookkeepingWatcher: Quark<ConfigType, 'bookkeeping'>;

    public constructor(@inject(ConfigRepository) private readonly configRepository: ConfigRepository, @inject(PoolsHelper) private readonly poolsHelper: PoolsHelper<string>) {
        super({});
        // 'sps' is the group_name in the config table
        // next is the object created from all the entries under that group_name
        // we create different "domain" objects (token, unstaking settings, staking pools) from that object
        this.spsWatcher = this.quark('sps').addWatch(SpsConfigLoader.VALIDATE, (previous, next) => {
            this.#token = next && token_schema.isValidSync(next) ? next : undefined;
            this.#unstaking = next && UnstakingSettings.validate(next) ? { get: (_?: string) => next } : undefined;
            this.#pools = next && this.poolsHelper.validate(next) ? next : undefined;
        });
        this.validatorWatcher = this.quark('validator').addWatch(SpsConfigLoader.VALIDATE, (previous, next) => {
            this.#validator = next && validator_schema.isValidSync(next) ? next : undefined;
        });
        this.validatorCheckInWatcher = this.quark('validator_check_in').addWatch(SpsConfigLoader.VALIDATE, (previous, next) => {
            this.#validator_check_in = next && validator_check_in_schema.isValidSync(next) ? next : undefined;
        });
        this.shopWatcher = this.quark('shop').addWatch(SpsConfigLoader.VALIDATE, (previous, next) => {
            this.#shop = next && shop_entries_schema.isValidSync(next) ? next : undefined;
        });
        this.bookkeepingWatcher = this.quark('bookkeeping').addWatch(SpsConfigLoader.VALIDATE, (previous, next) => {
            this.#bookkeeping = next && bookkeeping_entries_schema.isValidSync(next) ? next : undefined;
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
