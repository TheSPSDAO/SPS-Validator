import { ConfigType } from '../sps/convict-config';
import { inject, singleton } from 'tsyringe';
import { OperationFactory, payout, TransactionStarter, Trx } from '@steem-monsters/splinterlands-validator';
import seedrandom from 'seedrandom';

// TODO: Can be made an enum in the long run;
export type Method = string;

// TODO solved by routing differently
type virtual_ops = any;
type VirtualPayload = Record<string, unknown> | string | virtual_ops;

type OpOpts = {
    transaction: string;
    block_num: number;
    is_active: boolean;
    block_time: Date;
    is_virtual: boolean;
    block_reward: payout;
    trx: Trx;
};

@singleton()
export class OpsHelper {
    constructor(
        @inject(ConfigType) private readonly cfg: ConfigType,
        @inject(OperationFactory) private readonly factory: OperationFactory,
        @inject(TransactionStarter) private readonly transactionStarter: TransactionStarter,
    ) {}

    private async processOpHelper(
        op: any,
        block_num: number,
        block_id: string,
        prev_block_id: string,
        trx_id: string,
        block_time: Date,
        isVirtual: boolean,
        block_reward: payout,
        trx?: Trx,
    ) {
        const operation = this.factory.build(
            {
                block_num,
                block_time,
                previous: prev_block_id,
                block_id,
                prng: seedrandom(`${block_id}${prev_block_id}`),
            },
            block_reward,
            op,
            trx_id,
            0,
            isVirtual,
        );
        if (trx) {
            await operation.process(trx);
        } else {
            await this.transactionStarter.withTransaction(async (trx) => {
                await operation.process(trx);
            });
        }
    }

    public async processVirtualOp(
        method: Method,
        username: string,
        payload: VirtualPayload,
        { transaction = 'some-trx', block_num = 1, is_active = true, block_time = new Date(), is_virtual = true, block_reward = 0, trx }: Partial<OpOpts> = {},
    ) {
        const auth: Record<string, unknown> = {};
        auth[is_active ? 'required_auths' : 'required_posting_auths'] = [username];
        const id = method === this.cfg.custom_json_id ? method : `${this.cfg.custom_json_prefix}${method}`;
        return this.processOpHelper(
            [
                null,
                {
                    ...auth,
                    id,
                    json: payload,
                },
            ],
            block_num,
            String(1),
            String(0),
            transaction,
            block_time,
            is_virtual,
            block_reward,
            trx,
        );
    }

    public async processOp(method: Method, username: string, payload: Array<Record<string, unknown>> | Record<string, unknown> | string, opts?: Partial<OpOpts>) {
        const stringified_payload = typeof payload === 'string' ? payload : JSON.stringify(payload);
        return this.processVirtualOp(method, username, stringified_payload, { ...opts, is_virtual: false });
    }
}
