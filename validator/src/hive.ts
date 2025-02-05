import { Client, TransactionConfirmation } from 'splinterlands-dhive-sl';
import { LogLevel } from './utils';
import { ValidatorOpts } from './processor';
import { PrefixOpts } from './entities/operation';

export type HiveOptions = {
    rpc_nodes: string[];
    rpc_timeout?: number;
    logging_level: LogLevel;
    blocks_behind_head: number;
    replay_batch_size: number;

    hive_engine_rpc_nodes: string[];
};
export const HiveOptions: unique symbol = Symbol('HiveOptions');

export type PriceUpdate = {
    token: string;
    price: number;
};

export class HiveClient extends Client {
    constructor(readonly cfg: HiveOptions, private readonly validatorConfig: ValidatorOpts, private readonly prefixOpts: PrefixOpts) {
        super({
            nodes: cfg.rpc_nodes,
            // Our LogLevel happens to be compatible with dhive-sl's version.
            loggingLevel: cfg.logging_level.valueOf(),
            timeout: cfg.rpc_timeout,
            stream: { blocksBehindHead: cfg.blocks_behind_head, replayBatchSize: cfg.replay_batch_size, mode: 'latest' },
            skipTransactionQueue: true,
            engine: {
                nodes: cfg.hive_engine_rpc_nodes,
            },
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
                role: 'posting',
            },
            this.validatorConfig.validator_key,
        );
    }

    public submitBlockValidation(block_num: number, hash: string, version: string): Promise<TransactionConfirmation> {
        if (!this.validatorConfig.validator_account || !this.validatorConfig.validator_key) {
            throw new Error(`Attempting to submit block validation without setting up a validator account/key.`);
        }

        return this.broadcast.customJson(
            {
                id: this.prefixOpts.custom_json_id,
                json: {
                    action: 'validate_block',
                    params: { block_num, hash, reward_account: this.validatorConfig.reward_account || undefined, version },
                },
                account: this.validatorConfig.validator_account,
                role: 'posting',
            },
            this.validatorConfig.validator_key,
        );
    }

    public async submitPriceFeed(updates: PriceUpdate[], metadata?: unknown) {
        if (!this.validatorConfig.validator_account || !this.validatorConfig.validator_key) {
            throw new Error(`Attempting to submit price feed without setting up a validator account/key.`);
        }

        return this.broadcast.customJson(
            {
                id: this.prefixOpts.custom_json_id,
                json: {
                    action: 'price_feed',
                    params: { updates, metadata },
                },
                account: this.validatorConfig.validator_account,
                role: 'posting',
            },
            this.validatorConfig.validator_key,
        );
    }

    /**
     * Gets the price of the token on Hive Engine in HIVE.
     */
    public async getHiveEnginePrice(symbol: string): Promise<string> {
        const result = await this.engine.marketpools.getPools(symbol);
        if (!result || !result.length) {
            throw new Error('Failed to fetch Hive Engine price');
        }
        return result[0].basePrice;
    }
}
