// This seems to be the most technically correct way to import convict.
import convict = require('convict');
import validators = require('convict-format-with-validator');
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
    staking_rewards_account: {
        doc: 'Default system account to track all staking rewards',
        nullable: false,
        default: '$TOKEN_STAKING_REWARDS',
        env: 'STAKING_REWARDS_ACCOUNT',
    },
    enable_check_ins: {
        doc: 'Enable check ins. Must have validator account and validator key set as well.',
        format: Boolean,
        default: true,
        env: 'ENABLE_CHECK_INS',
    },
    helmetjs: {
        doc: 'Enable helmetjs security middleware',
        format: Boolean,
        default: false,
        env: 'HELMETJS',
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
