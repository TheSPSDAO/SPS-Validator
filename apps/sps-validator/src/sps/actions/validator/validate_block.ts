import {
    Action,
    BalanceRepository,
    BlockRepository,
    ErrorType,
    EventLog,
    HiveAccountRepository,
    OperationData,
    Trx,
    ValidationError,
    ValidatorWatch,
} from '@steem-monsters/splinterlands-validator';
import { validate_block } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class ValidateBlockAction extends Action<typeof validate_block.actionSchema> {
    private readonly reward_account: string;
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly watcher: ValidatorWatch,
        private readonly blockRepository: BlockRepository,
        private readonly balanceRepository: BalanceRepository,
        private readonly accountRepository: HiveAccountRepository,
    ) {
        super(validate_block, op, data, index);
        this.reward_account = this.params.reward_account ?? this.op.account;
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

        if (this.watcher.validator?.paused_until_block > this.op.block_num) {
            throw new ValidationError('The validator is paused.', this, ErrorType.BlockValidationPaused);
        }

        // Make sure the block hasn't already been validated
        if (block.validation_tx) {
            throw new ValidationError('The specified block has already been validated.', this, ErrorType.AlreadyValidatedBlock);
        }

        // Check that the provided block hash matches
        if (block.l2_block_id !== this.params.hash) {
            throw new ValidationError('The specified hash does not match.', this, ErrorType.BlockHashMismatch);
        }

        const validRewardAccount = await this.accountRepository.onlyHiveAccounts([this.reward_account], trx);
        if (!validRewardAccount) {
            throw new ValidationError('The specified reward account does not exist.', this, ErrorType.AccountNotKnown);
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        // Log the validation transaction id for the validated block
        const results: EventLog[] = [await this.blockRepository.insertValidation(this.params.block_num, this.op.transaction_id, trx)];

        // Award SPS tokens to the validator who validated this block
        const reward = this.op.block_reward;

        if (reward !== 0) {
            const [amount, token] = reward;
            if (amount > 0) {
                results.push(...(await this.balanceRepository.updateBalance(this, '$VALIDATOR_REWARDS', this.reward_account, token, amount, this.action_name, trx)));
            }
        }

        return results;
    }
}

const Builder = MakeActionFactory(ValidateBlockAction, ValidatorWatch, BlockRepository, BalanceRepository, HiveAccountRepository);
export const Router = MakeRouter(validate_block.action_name, Builder);
