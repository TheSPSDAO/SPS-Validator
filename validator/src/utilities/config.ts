import * as utils from '../utils';
import { LogLevel } from '../utils';
import { BaseRepository, Handle, ConfigEntity as Config_, Trx } from '../db/tables';
import { Result } from '@steem-monsters/lib-monad';

// TODO: Convert config type to be something useful, at the moment it's just random strings in a database.
type ConfigEntries = { [key: string]: unknown };
type ConfigUpdate = {
    group_name: string;
    name: string;
    value: null | string;
};

export type ConfigData = number | Date | object | Array<unknown> | string | boolean;

export class ConfigRepository extends BaseRepository {
    private readonly config: ConfigEntries = {};

    public constructor(handle: Handle) {
        super(handle);
    }

    public static parse_value(value: string, type: 'number'): number;
    public static parse_value(value: string, type: 'date'): Date;
    public static parse_value(value: string, type: 'object'): object;
    public static parse_value(value: string, type: 'array'): Array<unknown>;
    public static parse_value(value: string, type: 'string'): string;
    public static parse_value(value: string, type: 'boolean'): boolean;
    public static parse_value(value: string, type: string): string;
    public static parse_value(value: string, type: string): ConfigData {
        try {
            switch (type) {
                case 'number':
                    return parseFloat(value);
                case 'date':
                    return new Date(value);
                case 'object':
                case 'array':
                    return JSON.parse(value);
                case 'string':
                    return value;
                case 'boolean':
                    return !!JSON.parse(value);
                default:
                    throw Error('Stored config in db cannot be parsed');
            }
        } catch (err: any) {
            utils.log(`Error parsing config value: ${value} of type ${type}. Error: ${err && err.message ? err.message : err}`, LogLevel.Error);
            return value;
        }
    }

    public static unparse_value_safe(value: ConfigData): Result<string, Error> {
        try {
            const unparsed = ConfigRepository.unparse_value(value);
            return Result.Ok(unparsed);
        } catch (error) {
            return Result.Err(error instanceof Error ? error : new Error(String(error)));
        }
    }

    public static unparse_value(value: ConfigData): string {
        switch (typeof value) {
            case 'string':
                return value;
            case 'number':
                return value.toString();
            case 'object':
                if (Array.isArray(value)) {
                    return JSON.stringify(value);
                } else if (value instanceof Date) {
                    return value.toISOString();
                } else {
                    return JSON.stringify(value);
                }
            case 'boolean':
                return JSON.stringify(value);
            default:
                throw Error('Config for db cannot be unparsed');
        }
    }

    public async load(trx?: Trx) {
        const config_records = await this.query(Config_, trx).orderBy('group_name').orderBy('index').getMany();

        Object.keys(this.config).forEach((key) => delete this.config[key]);
        this.applyConfigRecords(this.config, config_records);

        utils.log(`Config Loaded from table!`, LogLevel.Info);
        return this.config;
    }

    public async exists(payload: Omit<ConfigUpdate, 'value'>, trx?: Trx) {
        const count = await this.query(Config_, trx).where('group_name', payload.group_name).andWhere('name', payload.name).getCount();
        return Number(count) > 0;
    }

    /**
     * Loads the current config, applies the update, and returns it without saving to the database.
     */
    public async testUpdate(payload: ConfigUpdate, trx?: Trx) {
        const config_records = await this.query(Config_, trx).orderBy('group_name').orderBy('index').getMany();
        const match = config_records.find((config_record) => config_record.group_name === payload.group_name && config_record.name === payload.name);
        if (match) {
            match.value = payload.value;
        }

        const config: ConfigEntries = {};
        this.applyConfigRecords(config, config_records);
        return config;
    }

    private applyConfigRecords(config_entries: ConfigEntries, config_records: Config_[]) {
        config_records.forEach((config_record) => {
            const { group_name, group_type, value, value_type, name } = config_record;
            const parsed_value = ConfigRepository.parse_value(value!, value_type);

            if (!group_name || group_name == '$root') {
                config_entries[config_record.name] = parsed_value;
                return;
            }

            const is_array = group_type === 'array';

            if (!config_entries[group_name]) config_entries[group_name] = is_array ? [] : {};

            if (is_array) {
                const group = config_entries[group_name] as unknown[];
                group.push(parsed_value);
            } else {
                const group = config_entries[group_name] as any;
                group[name] = parsed_value;
            }
        });
    }

    public update(payload: ConfigUpdate, trx?: Trx): Promise<void> {
        return this.query(Config_, trx)
            .useKnexQueryBuilder((query) =>
                query
                    .where({
                        group_name: payload.group_name,
                        name: payload.name,
                    })
                    .update({ value: payload.value }),
            )
            .execute();
    }

    public updateReturning(payload: ConfigUpdate, trx?: Trx): Promise<Config_> {
        // TODO - this throws if the item doesn't exist. it shouldn't?
        return this.query(Config_, trx).where('group_name', payload.group_name).andWhere('name', payload.name).updateItemWithReturning({ value: payload.value });
    }
}
