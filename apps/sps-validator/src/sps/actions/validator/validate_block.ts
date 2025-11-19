import {
    Action,
    BalanceRepository,
    BlockRepository,
    ErrorType,
    EventLog,
    OperationData,
    Trx,
    ValidationError,
    ValidatorRepository,
    ValidatorWatch,
} from '@steem-monsters/splinterlands-validator';
import { validate_block } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

// TODO: this should be in the config
export const VALIDATE_BLOCK_REWARD_ACCOUNT = '$VALIDATOR_REWARDS';

export class ValidateBlockAction extends Action<typeof validate_block.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly watcher: ValidatorWatch,
        private readonly blockRepository: BlockRepository,
        private readonly balanceRepository: BalanceRepository,
        private readonly validatorRepository: ValidatorRepository,
    ) {
        super(validate_block, op, data, index);
    }

    async validate(trx?: Trx) {
        const block = await this.blockRepository.getByBlockNum(this.params.block_num, trx);

        if (!block) {
            throw new ValidationError('Specified block not found.', this, ErrorType.NoSuchBlock);
        }

        // Check that the specified block was assigned to the account that submitted this transaction
        if (block.validator !== this.op.account) {
            throw new ValidationError('The specified block was not assigned to this account to validate.', this, ErrorType.WrongBlockValidator);
        }

        if (!this.watcher.validator) {
            throw new ValidationError('This validator node has an incompatible configuration. try again later', this, ErrorType.MisconfiguredValidator);
        }

        // Check that the block is not too old
        if (this.op.block_num - this.params.block_num > this.watcher.validator.max_block_age) {
            throw new ValidationError('The specified block is too old to be validated.', this, ErrorType.OldBlock);
        }

        if (this.watcher.validator?.paused_until_block > this.params.block_num) {
            throw new ValidationError('Block validation is paused.', this, ErrorType.BlockValidationPaused);
        }

        // Make sure the block hasn't already been validated
        if (block.validation_tx) {
            throw new ValidationError('The specified block has already been validated.', this, ErrorType.AlreadyValidatedBlock);
        }

        // Check that the provided block hash matches
        if (block.l2_block_id !== this.params.hash) {
            throw new ValidationError('The specified hash does not match.', this, ErrorType.BlockHashMismatch);
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const validator = await this.validatorRepository.lookup(this.op.account, this.op.block_num, trx);
        // this should _never_ happen
        if (!validator) {
            throw new ValidationError('Validator not found.', this, ErrorType.AccountNotKnown);
        }

        const reward_account = validator.reward_account ?? this.op.account;
        // Log the validation transaction id for the validated block
        const results: EventLog[] = [await this.blockRepository.insertValidation(this.params.block_num, this.op.transaction_id, trx)];

        // Award SPS tokens to the validator who validated this block
        const reward = this.op.block_reward;
        if (reward !== 0) {
            const [amount, token] = reward;
            if (amount > 0) {
                results.push(...(await this.balanceRepository.updateBalance(this, VALIDATE_BLOCK_REWARD_ACCOUNT, reward_account, token, amount, this.action_name, trx)));
            }
        }

        // update the validators version if needed
        if (validator.last_version !== this.params.version) {
            results.push(...(await this.validatorRepository.updateVersion(this.op.account, this.params.version, this, trx)));
        }

        // update the consecutive missed blocks count for the validator
        // this will only be run once the transition happens to enable this field. If the field is not enabled, it will be undefined and this will be a no-op
        if (validator.consecutive_missed_blocks !== undefined && validator.consecutive_missed_blocks > 0) {
            results.push(...(await this.validatorRepository.resetConsecutiveMissedBlocks(this.op.account, this, trx)));
        }

        return results;
    }
}

const Builder = MakeActionFactory(ValidateBlockAction, ValidatorWatch, BlockRepository, BalanceRepository, ValidatorRepository);
export const Router = MakeRouter(validate_block.action_name, Builder);
