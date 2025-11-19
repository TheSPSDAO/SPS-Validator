import { BalanceRepository, HiveAccountRepository, OperationData, TokenSupport, Trx, Action, ValidationError, ErrorType, EventLog } from '@steem-monsters/splinterlands-validator';
import { SUPPORTED_TOKENS } from '../../features/tokens';
import { token_transfer } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { TransitionManager } from '../../features/transition';

export function isValidTokenTransferKey(key: unknown): key is string {
    if (typeof key !== 'string' || key.length === 0 || key.length > 64) {
        return false;
    }
    return true;
}

export class TokenTransferAction extends Action<typeof token_transfer.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly balanceRepository: BalanceRepository,
        private readonly hiveAccountRepository: HiveAccountRepository,
        private readonly transitionManager: TransitionManager,
    ) {
        super(token_transfer, op, data, index);
    }

    protected validateAccounts(names: string[], trx?: Trx): Promise<boolean> {
        return this.hiveAccountRepository.onlyHiveOrSystemAccounts(names, trx);
    }

    async validate(trx?: Trx) {
        // Set the "to" account to all lowercase and trim any whitespace
        if (!this.params.to.startsWith('$')) this.params.to = this.params.to.toLowerCase().trim();

        if (this.params.to === this.op.account) {
            throw new ValidationError('You cannot transfer tokens to yourself.', this, ErrorType.SelfTransfer);
        }

        // Check that the sender has enough tokens in their account
        const balance = await this.balanceRepository.getBalance(this.op.account, this.params.token, trx);
        if (balance < this.params.qty) {
            throw new ValidationError('Insufficient balance.', this, ErrorType.InsufficientBalance);
        }

        const onlyValidAccounts = await this.validateAccounts([this.params.to], trx);
        if (!onlyValidAccounts) {
            throw new ValidationError('You cannot transfer tokens to a non existing Hive account.', this, ErrorType.AccountNotKnown);
        }

        if (this.params.key !== undefined && this.transitionManager.isTransitioned('adjust_token_distribution_strategy', this.op.block_num)) {
            if (!isValidTokenTransferKey(this.params.key)) {
                throw new ValidationError('Invalid transfer key. The key must be a non-empty string with a maximum length of 64 characters.', this, ErrorType.InvalidTransferKey);
            }
            // check for token transfer key to prevent double transfers
            const keyExists = await this.balanceRepository.tokenTransferKeysExist(this.op.account, [this.params.key], trx);
            if (keyExists) {
                throw new ValidationError('A transfer for this key has already been processed for this account.', this, ErrorType.DuplicateTransferKey);
            }
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        // Add the recipient to the list of players affected by this action
        this.players.push(this.params.to);
        const eventLogs: EventLog[] = [];
        eventLogs.push(...(await this.balanceRepository.updateBalance(this, this.op.account, this.params.to, this.params.token, this.params.qty, this.action_name, trx)));

        if (this.params.key && this.transitionManager.isTransitioned('adjust_token_distribution_strategy', this.op.block_num)) {
            // Insert the token transfer key to prevent double transfers
            eventLogs.push(await this.balanceRepository.insertTokenTransferKey(this.op.account, this.params.key, this, trx));
        }

        return eventLogs;
    }

    override isSupported() {
        return TokenSupport.canTransfer(SUPPORTED_TOKENS, this.params.token, this.params.qty);
    }
}

const Builder = MakeActionFactory(TokenTransferAction, BalanceRepository, HiveAccountRepository, TransitionManager);
export const Router = MakeRouter(token_transfer.action_name, Builder);
