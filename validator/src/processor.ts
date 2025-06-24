import Operation, { OperationFactory, PrefixOpts } from './entities/operation';
import { ValidatorEntry, ValidatorRepository } from './entities/validator/validator';
import { ValidatorWatch } from './config';
import { HiveClient } from './hive';
import * as utils from './utils';
import { BlockRepository, LastBlockCache, NBlock } from './entities/block';
import { HiveAccountRepository } from './entities/account/hive_account';
import { TransactionStarter } from './db/transaction';
import { SynchronisationClosure } from './sync';
import { TopLevelVirtualPayloadSource } from './actions/virtual';
import {
    AccountCreateOperation,
    AccountCreateWithDelegationOperation,
    CreateClaimedAccountOperation,
    CustomJsonOperation,
    Operation as BlockOperation,
} from 'splinterlands-dhive-sl';
import { payout } from './utilities/token_support';
import { SynchronisationConfig } from './sync/type';
import { EventLog } from './entities/event_log';
import { isDefined } from './libs/guards';
import { Trx } from './lib';

export type ValidatorOpts = {
    validator_account: string | null;
    validator_key: string | null;
    version: string;
};
export const ValidatorOpts: unique symbol = Symbol('ValidatorOpts');

export type PostProcessor = {
    onHashProduced: (blockNum: number, hash: string, trx: Trx) => Promise<void>;
};

type UnionAccountCreation = AccountCreateOperation | AccountCreateWithDelegationOperation | CreateClaimedAccountOperation;

export class BlockProcessor<T extends SynchronisationConfig> {
    public constructor(
        // TODO: way too many params/responsibilities
        private readonly trxStarter: TransactionStarter,
        private readonly topLevelVirtualPayloadSource: TopLevelVirtualPayloadSource,
        private readonly blockRepository: BlockRepository,
        private readonly operationFactory: OperationFactory,
        private readonly validatorRepository: ValidatorRepository,
        private readonly prefix: PrefixOpts,
        private readonly validatorOpts: ValidatorOpts,
        private readonly watcher: ValidatorWatch,
        private readonly hiveAccountRepository: HiveAccountRepository,
        private readonly hive: HiveClient,
        public readonly lastBlockCache: LastBlockCache,
        private readonly sync: SynchronisationClosure<T>,
        private readonly special_ops: Map<string, string> = new Map(),
    ) {}

    public async process(block: NBlock, headBlock: number): Promise<{ block_hash: string; event_logs: EventLog[] }> {
        const operations: Operation[] = [];
        const transformedBlock = this.transformBlock(block);
        await this.sync.waitToProcessBlock(transformedBlock.block_num);
        const block_hash = await this.trxStarter.withTransaction(async (trx) => {
            const reward = this.calculateBlockReward(transformedBlock);
            // TODO: procesVirtualOps
            const wrappedPayloads = await this.topLevelVirtualPayloadSource.process(transformedBlock, trx);
            for (const wrappedPayload of wrappedPayloads) {
                const { trx_id, payloads } = wrappedPayload;
                for (let i = 0; i < payloads.length; i++) {
                    const data = payloads[i];
                    const op = this.operationFactory.build(transformedBlock, reward, data, trx_id, i, true);
                    operations.push(op);
                    await op.process(trx);
                }
            }

            for (const t of transformedBlock.transactions) {
                for (const [op_index, op] of t.transaction.operations.entries()) {
                    if (BlockProcessor.isAccountCreationOperation(op)) {
                        await this.hiveAccountRepository.upsert({ name: op[1].new_account_name, authority: {} });
                        continue;
                    }

                    // Check if this is an operation that validator nodes should process
                    if (!(BlockProcessor.isCustomJsonOperation(op) && (this.isValidatorOperation(op) || this.isSpecialCustomJsonOperation(op)))) {
                        continue;
                    }

                    const operation = this.operationFactory.build(transformedBlock, reward, op, t.id, op_index);
                    operations.push(operation);
                    await operation.process(trx);
                }
            }

            // Load the validator for this block
            const validator = await this.validatorRepository.getBlockValidator(transformedBlock, trx);
            const { block_num, l2_block_id } = await this.blockRepository.insertProcessed(transformedBlock, operations, validator, trx);
            this.lastBlockCache.update(transformedBlock);

            // If we are the validator chosen for this block, submit the block hash to validate it
            if (this.isChosenValidator(validator)) {
                const maxBlockAge = this.watcher.validator?.max_block_age;
                if (maxBlockAge && headBlock - maxBlockAge <= block_num) {
                    this.trySubmitBlockValidation(block_num, l2_block_id);
                } else {
                    utils.log(`Block [${block_num}] is too old to validate - not submitting validate tx.`);
                }
            }

            return l2_block_id;
        });

        return {
            event_logs: operations.flatMap((x) => x.actions.flatMap((x) => x.result).filter(isDefined)),
            block_hash,
        };
    }

    /**
     * Hook to modify the block data before processing.
     * This is currently used to fix replay because of a microfork that the splinterlands node read
     */
    protected transformBlock(block: NBlock): NBlock {
        return block;
    }

    private async trySubmitBlockValidation(block_num: number, l2_block_id: string, attempts = 5): Promise<void> {
        const maxAttempts = attempts;
        while (attempts > 0) {
            try {
                await this.hive.submitBlockValidation(block_num, l2_block_id, this.validatorOpts.version);
                utils.log(`Submitted block validation for block [${block_num}] with hash [${l2_block_id}]`);
                return;
            } catch (e) {
                utils.log(`Failed to submit block validation for block [${block_num}] with hash [${l2_block_id}]. Retrying...`);
                attempts--;
                const delay = 1000 * (maxAttempts - attempts);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        utils.log(`Failed to submit block validation for block [${block_num}] with hash [${l2_block_id}] after ${maxAttempts} attempts.`);
    }

    private isChosenValidator(validator: ValidatorEntry | null): boolean {
        return !!this.validatorOpts.validator_account && !!this.validatorOpts.validator_key && this.validatorOpts.validator_account === validator?.account_name;
    }

    private static isCustomJsonOperation(op: BlockOperation): op is CustomJsonOperation {
        return op[0] === 'custom_json';
    }

    private static isAccountCreationOperation(op: BlockOperation): op is UnionAccountCreation {
        return ['account_create', 'account_create_with_delegation', 'create_claimed_account'].includes(op[0]);
    }

    private isSpecialCustomJsonOperation(op: CustomJsonOperation): boolean {
        const special_id = this.special_ops.get(op[1].id);
        if (!special_id) return false;

        op[1].id = `${this.prefix.custom_json_prefix}_${special_id}`;

        return true;
    }

    private isValidatorOperation(op: CustomJsonOperation): boolean {
        return op[1].id === this.prefix.custom_json_id || op[1].id.startsWith(this.prefix.custom_json_prefix);
    }

    private calculateBlockReward(block: NBlock): payout {
        const validator = this.watcher.validator;
        // No block rewards for broken blocks!
        if (validator === undefined) {
            return 0;
        }
        const elapsed_blocks = block.block_num - validator.reward_start_block;
        // Return 0 if rewards haven't started yet
        if (elapsed_blocks < 0) return 0;

        const token = validator.reward_token;
        // Reduce the validator block rewards by {reduction_pct}% every {reduction_blocks} blocks (1% per month)
        const reward = +(validator.tokens_per_block * (1 - (parseInt(`${elapsed_blocks / validator.reduction_blocks}`) * validator.reduction_pct) / 100)).toFixed(3);
        return [reward, token];
    }
}
