import * as utils from '../utils';
import { LookupWrapper } from '../actions/transition';
import { ConfigLoader, ConfigType as DbConfigType } from '../config';
import { IAction } from '../actions/action';
import { BlockRef } from './block';
import { CustomJsonOperation } from 'splinterlands-dhive-sl';
import { Trx } from '../db/tables';
import { ProcessResult } from '../actions/virtual';
import { payout } from '../utilities/token_support';

const posting_auth_actions = [
    'token_award',
    'stake_tokens',
    'stake_tokens_multi',
    'unstake_tokens',
    'claim_staking_rewards',
    'cancel_unstake_tokens',
    'delegate_tokens',
    'undelegate_tokens',
    'undelegate_tokens_multi',
    'return_tokens',
    'fulfill_promise',
    'fulfill_promise_multi',
    'activate_license',
    'deactivate_license',
    'validate_block',
    'check_in_validator',
    'price_feed',
];

// TODO: Return instantiated action, or null
export class ActionOrBust {
    public constructor(private readonly lookupWrapper: LookupWrapper) {}
    public createAction(op: Operation, data: any, index?: number): IAction | null {
        if (typeof data?.action !== 'string') {
            return null;
        }

        // need to do this check here, because we have two formats for actions that we accept
        const isAuthorized = posting_auth_actions.includes(data.action) || op.active_auth;
        if (!isAuthorized) {
            return null;
        }

        const factory = this.lookupWrapper.lookupOpsConstructor(op.block_num, data.action, op.isVirtual);
        if (!factory) return null;
        try {
            const action = factory.build(op, data, index);
            // Checks regardless of whether this action is supported by this validator node (for example, DEC transfers are not supported and this should return null for them)
            return action.isSupported() ? action : null;
        } catch (_) {
            return null;
        }
    }
}

export type PrefixOpts = {
    custom_json_prefix: string;
    custom_json_id: string;
};
export const PrefixOpts: unique symbol = Symbol('PrefixOpts');

export type OperationData = {
    readonly active_auth: boolean;
    readonly account: string;
    readonly block_num: number;
    readonly block_time: Date;
    readonly block_reward: payout;
    readonly block: BlockRef;
    readonly trx_op_id: string;
    readonly transaction_id: string;
};

export default class Operation implements OperationData {
    public readonly active_auth: boolean;
    public readonly account: string;
    public readonly id: string;
    public readonly block_num: number;
    public readonly block_time: Date;
    public readonly block_reward: payout;
    public readonly actions: IAction[];
    private readonly base_id: string;

    constructor(
        private readonly actionOrBust: ActionOrBust,
        private readonly config: DbConfigType,
        private readonly cfg: PrefixOpts,
        public readonly block: BlockRef,
        reward: payout,
        public readonly op: CustomJsonOperation | ProcessResult,
        public readonly transaction_id: string,
        public readonly op_index: number,
        public readonly isVirtual = false,
    ) {
        this.block = block;
        this.block_num = block.block_num;
        this.block_time = block.block_time;
        this.block_reward = reward;
        this.transaction_id = transaction_id;
        this.op_index = op_index;

        this.active_auth = op[1].required_auths && op[1].required_auths.length > 0;
        this.account = this.active_auth ? op[1].required_auths[0] : op[1].required_posting_auths[0];
        this.id = op[1].id;
        this.base_id = this.id.replace(this.cfg.custom_json_prefix, '');

        const data = typeof op[1].json === 'object' ? op[1].json : utils.tryParse(op[1].json);

        let actions: Array<IAction | null>;

        if (this.id === this.cfg.custom_json_id) {
            actions = Array.isArray(data) ? data.map((a, i) => this.actionOrBust.createAction(this, a, i)) : [this.actionOrBust.createAction(this, data)];
        } else if (this.id.startsWith(this.cfg.custom_json_prefix)) {
            // Backwards compatibility with "sm_" custom json ids
            actions = [
                this.actionOrBust.createAction(this, {
                    action: this.base_id,
                    params: data,
                }),
            ];
        } else if (this.base_id === this.id) {
            // Special operation where prefix was not cut off.
            actions = [
                this.actionOrBust.createAction(this, {
                    action: this.base_id,
                    params: data,
                }),
            ];
        } else {
            actions = [];
        }

        // Filter out any unsupported actions (null)
        this.actions = actions.filter((a): a is IAction => a !== null);
    }

    async process(trx?: Trx): Promise<void> {
        for (let i = 0; i < this.actions.length; i++) {
            await this.actions[i].execute(trx);
        }
    }
    get trx_op_id(): string {
        return this.op_index && this.op_index > 0 ? `${this.transaction_id}-${this.op_index}` : this.transaction_id;
    }
}

export class OperationFactory {
    public constructor(private readonly actionOrBust: ActionOrBust, private readonly configLoader: ConfigLoader, private readonly cfg: PrefixOpts) {}
    public build(block: BlockRef, reward: payout, op: CustomJsonOperation | ProcessResult, transaction_id: string, op_index: number, isVirtual?: boolean): Operation {
        return new Operation(this.actionOrBust, this.configLoader.value, this.cfg, block, reward, op, transaction_id, op_index, isVirtual);
    }
}

export function asOperationFactory(
    fn: (block: BlockRef, reward: payout, op: CustomJsonOperation | ProcessResult, transaction_id: string, op_index: number, isVirtual?: boolean) => Operation,
) {
    return <OperationFactory>{
        build: fn,
    };
}
