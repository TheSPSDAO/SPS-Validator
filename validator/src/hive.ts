import { Client, TransactionConfirmation } from 'splinterlands-dhive-sl';
import { LogLevel } from './utils';
import { ValidatorOpts } from './processor';
import { PrefixOpts } from './entities/operation';

export type HiveOptions = {
    rpc_nodes: Array<string>;
    logging_level: LogLevel;
    blocks_behind_head: number;
    replay_batch_size: number;
};
export const HiveOptions: unique symbol = Symbol('HiveOptions');

export class HiveClient extends Client {
    constructor(private readonly cfg: HiveOptions, private readonly validatorConfig: ValidatorOpts, private readonly prefixOpts: PrefixOpts) {
        super({
            nodes: cfg.rpc_nodes,
            // Our LogLevel happens to be compatible with dhive-sl's version.
            loggingLevel: cfg.logging_level.valueOf(),
            stream: { blocksBehindHead: cfg.blocks_behind_head, replayBatchSize: cfg.replay_batch_size, mode: 'latest' },
            skipTransactionQueue: true,
        });
    }

    public submitCheckIn(block_num: number, hash: string): Promise<TransactionConfirmation> {
        if (!this.validatorConfig.validator_account || !this.validatorConfig.validator_key) {
            throw new Error(`Attempting to submit check in without setting up a validator account/key.`);
        }

        return this.broadcast.customJson(
            {
                id: this.prefixOpts.custom_json_id,
                json: {
                    action: 'check_in_validator',
                    params: { block_num, hash, reward_account: this.validatorConfig.reward_account || undefined },
                },
                account: this.validatorConfig.validator_account,
                role: 'active',
            },
            this.validatorConfig.validator_key,
        );
    }

    public submitBlockValidation(block_num: number, hash: string): Promise<TransactionConfirmation> {
        if (!this.validatorConfig.validator_account || !this.validatorConfig.validator_key) {
            throw new Error(`Attempting to submit block validation without setting up a validator account/key.`);
        }

        return this.broadcast.customJson(
            {
                id: this.prefixOpts.custom_json_id,
                json: {
                    action: 'validate_block',
                    params: { block_num, hash, reward_account: this.validatorConfig.reward_account || undefined },
                },
                account: this.validatorConfig.validator_account,
                role: 'active',
            },
            this.validatorConfig.validator_key,
        );
    }
}
