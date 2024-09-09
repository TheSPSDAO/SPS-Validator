import { BalanceRepository, HiveAccountRepository, OperationData, TokenSupport, Trx, Action, ValidationError, ErrorType, EventLog } from '@steem-monsters/splinterlands-validator';
import { SUPPORTED_TOKENS } from '../../features/tokens';
import { token_transfer } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class TokenTransferAction extends Action<typeof token_transfer.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly balanceRepository: BalanceRepository,
        private readonly hiveAccountRepository: HiveAccountRepository,
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

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        // Add the recipient to the list of players affected by this action
        this.players.push(this.params.to);
        return await this.balanceRepository.updateBalance(this, this.op.account, this.params.to, this.params.token, this.params.qty, this.action_name, trx);
    }

    override isSupported() {
        return TokenSupport.canTransfer(SUPPORTED_TOKENS, this.params.token, this.params.qty);
    }
}

const Builder = MakeActionFactory(TokenTransferAction, BalanceRepository, HiveAccountRepository);
export const Router = MakeRouter(token_transfer.action_name, Builder);
