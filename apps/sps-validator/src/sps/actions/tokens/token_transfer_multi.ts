import { Action, BalanceRepository, ErrorType, EventLog, HiveAccountRepository, OperationData, TokenSupport, Trx, ValidationError } from '@steem-monsters/splinterlands-validator';
import { SUPPORTED_TOKENS } from '../../features/tokens';
import { token_transfer_multi } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { TransitionManager } from '../../features/transition';
import { isValidTokenTransferKey } from './token_transfer';

export class TokenTransferMultiAction extends Action<typeof token_transfer_multi.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly balanceRepository: BalanceRepository,
        private readonly hiveAccountRepository: HiveAccountRepository,
        private readonly transitionManager: TransitionManager,
    ) {
        super(token_transfer_multi, op, data, index);
    }

    override isSupported(): boolean {
        const hasTransfers = this.params.multi.length !== 0;
        if (!hasTransfers) {
            return false;
        } else {
            const transfers = this.params.multi.flatMap((x) => x.to.map((y) => ({ token: x.token, qty: y.qty }))); //.every((a => TokenSupport.canTransfer(this.supportedTokens, a.to));
            return transfers.every((entry) => TokenSupport.canTransfer(SUPPORTED_TOKENS, entry.token, entry.qty));
        }
    }

    protected validateAccounts(names: string[], trx?: Trx): Promise<boolean> {
        return this.hiveAccountRepository.onlyHiveOrSystemAccounts(names, trx);
    }

    async validate(trx?: Trx) {
        if (this.params.multi.some((x) => x.to.some((y) => y.name === this.op.account))) {
            throw new ValidationError('You cannot transfer tokens to yourself', this, ErrorType.SelfTransfer);
        }

        const tokens_required = this.params.multi.reduce((m, x) => {
            const current = m.get(x.token) ?? 0;
            m.set(x.token, current + x.to.reduce((acc, t) => acc + t.qty, 0));
            return m;
        }, new Map<string, number>());

        // TODO: Remove in the future, by creating a new action which doesn't have this restriction.
        if (tokens_required.size > 1) {
            throw new ValidationError('Transferring more than 1 token type is not supported at this block', this, ErrorType.NoMultiTokenTransfer);
        }

        const balances = (await this.balanceRepository.getBalances(this.op.account, trx)).reduce((m, x) => {
            const current = m.get(x.token) ?? 0;
            m.set(x.token, current + x.balance);
            return m;
        }, new Map<string, number>());

        for (const [token, required] of tokens_required) {
            const owned = balances.get(token) ?? 0;

            if (owned < required) {
                throw new ValidationError('Insufficient balance.', this, ErrorType.InsufficientBalance);
            }
        }

        const names = this.params.multi.flatMap((x) => x.to).flatMap((x) => x.name);
        const onlyValidAccounts = await this.validateAccounts(names, trx);
        if (!onlyValidAccounts) {
            throw new ValidationError('You cannot transfer tokens to a non existing Hive account.', this, ErrorType.AccountNotKnown);
        }

        if (this.transitionManager.isTransitioned('adjust_token_distribution_strategy', this.op.block_num)) {
            const transferKeys = this.params.multi
                .flatMap((x) => x.to)
                .flatMap((x) => x.key)
                .filter((k) => k !== undefined);
            const transferKeysUnique = new Set(transferKeys);
            if (transferKeys.length !== transferKeysUnique.size) {
                throw new ValidationError('Duplicate transfer keys are not allowed.', this, ErrorType.DuplicateTransferKey);
            }

            const invalidKeys = transferKeys.filter((k): k is string => !isValidTokenTransferKey(k));
            if (invalidKeys.length > 0) {
                throw new ValidationError('Invalid transfer keys. Each key must be a non-empty string with a maximum length of 64 characters.', this, ErrorType.InvalidTransferKey);
            }

            const transferKeysExist = await this.balanceRepository.tokenTransferKeysExist(this.op.account, transferKeys, trx);
            if (transferKeysExist) {
                throw new ValidationError('A transfer for one of these keys has already been processed for this account.', this, ErrorType.DuplicateTransferKey);
            }
        }

        return true;
    }

    protected async process(trx?: Trx): Promise<EventLog[]> {
        const affected_players = new Set(this.params.multi.flatMap((x) => x.to.map((t) => t.name)));
        this.players.push(...affected_players);

        const type = this.params.type || this.action_name;
        const transfers = this.params.multi.flatMap((x) => x.to.map((t) => ({ to: t.name, amount: t.qty, token: x.token, type: t.type || type, key: t.key })));
        const event_logs: EventLog[] = [];

        for (const transfer of transfers) {
            const event_log = await this.balanceRepository.updateBalance(this, this.op.account, transfer.to, transfer.token, transfer.amount, transfer.type, trx);
            event_logs.push(...event_log);
            if (transfer.key && this.transitionManager.isTransitioned('adjust_token_distribution_strategy', this.op.block_num)) {
                event_log.push(await this.balanceRepository.insertTokenTransferKey(this.op.account, transfer.key, this, trx));
            }
        }

        return event_logs;
    }
}

const Builder = MakeActionFactory(TokenTransferMultiAction, BalanceRepository, HiveAccountRepository, TransitionManager);
export const Router = MakeRouter(token_transfer_multi.action_name, Builder);
