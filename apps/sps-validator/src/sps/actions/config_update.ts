import { ConfigLoader, OperationData, AdminMembership, AdminAction, EventLog, Trx } from '@steem-monsters/splinterlands-validator';
import { config_update } from './schema';
import { MakeActionFactory, MakeRouter } from './utils';

export class ConfigUpdateAction extends AdminAction<typeof config_update.actionSchema> {
    readonly #configLoader: ConfigLoader;
    constructor(op: OperationData, data: unknown, index: number, adminMembership: AdminMembership, configLoader: ConfigLoader) {
        super(adminMembership, config_update, op, data, index);
        this.#configLoader = configLoader;
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
