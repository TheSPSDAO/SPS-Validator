// This seems to be the most technically correct way to import convict.
import convict from 'convict';
import validators from 'convict-format-with-validator';
import { DB_Connection, LogLevel } from '@steem-monsters/splinterlands-validator';
import isURL from 'format-validator/lib/isURL';

convict.addFormat(validators.url);
convict.addFormat({
    name: 'websocket_url',
    coerce: (v) => v.toString(),
    validate: function (x) {
        if (!isURL(x, { require_tld: false, protocols: ['ws', 'wss', 'http', 'https'] })) {
            throw new Error('must be a URL');
        }
    },
});

convict.addFormat({
    name: 'stringy-array',
    validate: function (val: string[], schema) {
        for (const element of val) {
            convict({ container: { default: '', format: schema.childFormat ?? String } })
                .load({ container: element })
                .validate();
        }
    },
    coerce: function (val: unknown) {
        if (typeof val === 'string') {
            return val.split(',');
        } else if (Array.isArray(val)) {
            for (const element of val) {
                if (typeof element !== 'string') {
                    return;
                }
            }
            return val;
        }
        return;
    },
});

convict.addFormat({
    name: 'stringy-object',
    validate: function (val: any, schema) {
        if (typeof val !== 'object') {
            throw Error('value does not seem to be an object. Please use a different format');
        }
        convict(schema.structure).load(val).validate();
    },
    coerce: function (val: unknown) {
        switch (typeof val) {
            case 'string':
                return JSON.parse(val);
            case 'object':
                return val;
            default:
                return null;
        }
    },
});

convict.addFormat({
    name: 'stringy-object-freeform',
    validate: function (val: any) {
        if (typeof val !== 'object') {
            throw Error('value does not seem to be an object. Please use a different format');
        }
    },
    coerce: function (val: unknown) {
        switch (typeof val) {
            case 'string':
                return JSON.parse(val);
            case 'object':
                return val;
            default:
                return null;
        }
    },
});

const schema = {
    env: {
        doc: 'The application environment',
        format: ['production', 'development', 'test', 'QA'],
        default: 'development',
        env: 'NODE_ENV',
    },
    logging_level: {
        doc: 'The application logging level',
        format: [LogLevel.Debug, LogLevel.Info, LogLevel.Warning, LogLevel.Error],
        default: LogLevel.Warning,
        env: 'LOGGING_LEVEL',
    },
    custom_json_id: {
        doc: 'Additional operations we are interested in',
        format: String,
        default: 'sps',
        env: 'CUSTOM_JSON_ID',
    },
    custom_json_prefix: {
        doc: 'The prefix for custom_json transactions that should be handled by the application',
        format: String,
        default: 'sm_',
        env: 'CUSTOM_JSON_PREFIX',
    },
    start_block: {
        doc: "The block number on which the application will start processing blocks, or 'HEAD'",
        format: String, // stringy number or 'HEAD', or null for default
        nullable: true,
        default: null as null | string,
        env: 'START_BLOCK',
    },
    blocks_behind_head: {
        doc: 'The amount of blocks to lag behind HEAD',
        format: 'nat',
        default: 1,
        env: 'BLOCKS_BEHIND_HEAD',
    },
    rpc_nodes: {
        doc: 'The Hive RPC nodes to connect to, in failover order',
        format: 'stringy-array',
        childFormat: 'url',
        default: ['https://api.hive.blog', 'https://anyx.io', 'https://api.openhive.network'],
        env: 'RPC_NODES',
    },
    hive_engine_rpc_nodes: {
        doc: 'The Hive Engine RPC nodes to connect to, in failover order',
        format: 'stringy-array',
        childFormat: 'url',
        default: [
            'https://api.hive-engine.com/rpc',
            'https://engine.rishipanthee.com',
            'https://herpc.dtools.dev',
            'https://ha.herpc.dtools.dev',
            'https://api.primersion.com',
            'https://herpc.kanibot.com',
            'https://ctpmain.com',
            'https://herpc.actifit.io',
        ],
        env: 'HIVE_ENGINE_RPC_NODES',
    },
    rpc_timeout: {
        doc: 'The timeout in ms for RPC requests',
        format: 'nat',
        default: 5000,
        env: 'RPC_TIMEOUT',
    },
    replay_batch_size: {
        doc: 'The amount of blocks to fetch in parallel when the application is behind on blocks',
        format: 'nat',
        default: 25,
        env: 'REPLAY_BATCH_SIZE',
    },
    reward_account: {
        format: String,
        doc: 'The account that receives the rewards',
        nullable: true,
        default: null as null | string,
        env: 'REWARD_ACCOUNT',
    },
    validator_account: {
        format: String,
        nullable: true,
        default: null as null | string,
        env: 'VALIDATOR_ACCOUNT',
    },
    validator_key: {
        format: String,
        nullable: true,
        default: null as null | string,
        env: 'VALIDATOR_KEY',
    },
    api_port: {
        format: 'port',
        nullable: true,
        default: null as null | number,
        env: 'API_PORT',
    },
    socket_url: {
        format: 'websocket_url',
        nullable: true,
        default: null as null | string,
        env: 'SOCKET_URL',
    },
    socket_key: {
        format: String,
        nullable: true,
        default: null as null | string,
        env: 'SOCKET_KEY',
        sensitive: true,
    },
    db_connection: {
        format: 'stringy-object',
        env: 'DB',
        default: {} as Partial<DB_Connection>,
        sensitive: true, // HACK: actually a property of password, but can currently not be propagated
        structure: {
            database: {
                doc: 'Database name',
                format: String,
                default: 'steemmonsters',
            },
            user: {
                doc: 'Username',
                format: String,
                default: 'postgres',
            },
            password: {
                doc: 'Password',
                format: String,
                default: 'password',
                sensitive: true, // HACK: not automatically propagated to the enclosing object, so ignored!
            },
            host: {
                doc: 'Database host name/IP',
                format: 'url',
                default: 'localhost',
            },
            port: {
                doc: 'Database port',
                format: 'port',
                default: 5432,
            },
        },
    },
    health_checker: {
        doc: 'Enable health checker http routes',
        format: 'Boolean',
        default: false,
        env: 'HEALTH_CHECKER',
    },
    sm_api_url: {
        doc: 'Url of SteemMonsters API',
        nullable: true,
        format: 'url',
        default: null as null | string,
        env: 'SM_API_URL',
    },
    block_processing: {
        doc: 'Enable block processing',
        format: 'Boolean',
        default: true,
        env: 'BLOCK_PROCESSING',
    },
    db_schema: {
        doc: 'Database schema (PSQL only)',
        nullable: true,
        format: String,
        default: null as null | string,
        env: 'DB_SCHEMA',
    },
    burn_account: {
        doc: 'Default hive account to clear all tokens from periodically',
        nullable: false,
        default: 'null',
        env: 'BURN_ACCOUNT',
    },
    burned_ledger_account: {
        doc: 'Default system account to track all permanently burned tokens on',
        nullable: false,
        default: '$BURNED',
        env: 'BURNED_LEDGER_ACCOUNT',
    },
    staking_account: {
        doc: 'Default system account to track all staking and unstaking transactions',
        nullable: false,
        default: '$TOKEN_STAKING',
        env: 'STAKING_ACCOUNT',
    },
    dao_account: {
        doc: 'SPS dao account',
        nullable: false,
        default: 'sps.dao',
        env: 'DAO_ACCOUNT',
    },
    dao_reserve_account: {
        doc: 'SPS dao reserve account',
        nullable: false,
        default: 'sps.dao.reserves',
        env: 'DAO_RESERVE_ACCOUNT',
    },
    sl_cold_account: {
        doc: 'SPS sl cold account',
        nullable: false,
        default: 'sl-cold',
        env: 'SL_COLD_ACCOUNT',
    },
    terablock_bsc_account: {
        doc: 'SPS terablock bsc account',
        nullable: false,
        default: 'terablock-bsc',
        env: 'TERABLOCK_BSC_ACCOUNT',
    },
    terablock_eth_account: {
        doc: 'SPS terablock eth account',
        nullable: false,
        default: 'terablock-eth',
        env: 'TERABLOCK_ETH_ACCOUNT',
    },
    reward_pool_accounts: {
        doc: 'SPS reward pool accounts',
        nullable: false,
        format: 'stringy-array',
        default:
            '$REWARD_POOLS_BRAWL,$REWARD_POOLS_LAND,$REWARD_POOLS_LICENSE,$VALIDATOR_REWARDS,$REWARD_POOLS_SOULKEEP,$REWARD_POOLS_MODERN,$REWARD_POOLS_WILD,$REWARD_POOLS_SURVIVAL,$UNCLAIMED_UNISWAP_REWARDS,$TOURNAMENTS_DISTRIBUTION,$TOKEN_STAKING_REWARDS,$REWARD_POOLS_FOCUS,$REWARD_POOLS_SEASON',
        env: 'REWARD_POOL_ACCOUNTS',
    },
    missed_blocks_account: {
        doc: 'Default system account to track all missed blocks',
        nullable: false,
        default: '$MISSED_BLOCKS',
        env: 'MISSED_BLOCKS_ACCOUNT',
    },
    enable_check_ins: {
        doc: 'Enable check ins. Must have validator account and validator key set as well.',
        format: Boolean,
        default: true,
        env: 'ENABLE_CHECK_INS',
    },
    price_feed_dao: {
        api_url: {
            doc: 'The URL of the DAO price feed API',
            format: 'url',
            default: 'https://prices.splinterlands.workers.dev',
            env: 'PRICE_FEED_DAO_API_URL',
        },
    },
    price_feed_coin_gecko: {
        api_url: {
            doc: 'The URL of the CoinGecko price feed API',
            format: 'url',
            default: 'https://pro-api.coingecko.com',
            env: 'PRICE_FEED_COIN_GECKO_API_URL',
        },
        api_key: {
            doc: 'The API key for the CoinGecko price feed API',
            nullable: true,
            format: String,
            default: null as null | string,
            env: 'PRICE_FEED_COIN_GECKO_API_KEY',
        },
    },
    price_feed_coin_market_cap: {
        api_url: {
            doc: 'The URL of the CoinMarketCap price feed API',
            format: 'url',
            default: 'https://pro-api.coinmarketcap.com',
            env: 'PRICE_FEED_COIN_MARKET_CAP_API_URL',
        },
        api_key: {
            doc: 'The API key for the CoinMarketCap price feed API',
            nullable: true,
            format: String,
            default: null as null | string,
            env: 'PRICE_FEED_COIN_MARKET_CAP_API_KEY',
        },
        token_map: {
            doc: 'The mapping of tokens to CoinMarketCap ids',
            format: 'stringy-object-freeform',
            default: {
                HIVE: '5370',
            } as Record<string, string>,
            env: 'PRICE_FEED_COIN_MARKET_CAP_TOKEN_MAP',
        },
    },
    helmetjs: {
        doc: 'Enable helmetjs security middleware',
        format: Boolean,
        default: false,
        env: 'HELMETJS',
    },
    version: {
        doc: 'The application version',
        format: String,
        default: 'development',
        env: 'VERSION',
    },
};

const config = convict(schema);

type ExtractConfigType<C extends convict.Config<any>> = C extends convict.Config<infer T> ? T : unknown;
export type ConfigType = ExtractConfigType<typeof config>;
export const ConfigType: unique symbol = Symbol.for('ConfigType');

// TODO: we might want to support loading in json files as well:
config.validate({ allowed: 'strict' });
const cfg: ConfigType = config.getProperties();

export default cfg;
