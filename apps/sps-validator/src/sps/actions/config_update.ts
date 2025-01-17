import { ConfigLoader, OperationData, AdminMembership, AdminAction, EventLog, Trx, ValidationError, ErrorType } from '@steem-monsters/splinterlands-validator';
import { config_update } from './schema';
import { MakeActionFactory, MakeRouter } from './utils';
import { Result } from '@steem-monsters/lib-monad';

export class ConfigUpdateAction extends AdminAction<typeof config_update.actionSchema> {
    readonly #configLoader: ConfigLoader;
    constructor(op: OperationData, data: unknown, index: number, adminMembership: AdminMembership, configLoader: ConfigLoader) {
        super(adminMembership, config_update, op, data, index);
        this.#configLoader = configLoader;
    }

    async validate(trx?: Trx): Promise<boolean> {
        await super.validate(trx);

        const errors: string[] = [];
        for (const update of this.params.updates) {
            const result = await this.#configLoader.validateUpdateConfig(update.group_name, update.name, update.value);
            if (Result.isErr(result)) {
                errors.push(...result.error);
            }
        }
        if (errors.length > 0) {
            throw new ValidationError(`Config update validation failed. ${errors.join('. ')}`, this, ErrorType.InvalidConfig);
        }
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const results = [];
        for (const update of this.params.updates) {
            results.push(await this.#configLoader.reloadingUpdateConfig(update.group_name, update.name, update.value, trx));
        }
        return results;
    }
}

const Builder = MakeActionFactory(ConfigUpdateAction, ConfigLoader, AdminMembership);
export const Router = MakeRouter(config_update.action_name, Builder);
