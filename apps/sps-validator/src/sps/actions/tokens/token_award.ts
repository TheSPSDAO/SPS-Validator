import { BalanceRepository, OperationData, TokenSupport, AdminMembership, AdminAction, ValidationError, ErrorType, Trx, EventLog } from '@steem-monsters/splinterlands-validator';
import { token_award } from '../schema';
import { SUPPORTED_TOKENS } from '../../features/tokens';
import { MakeActionFactory, MakeRouter } from '../utils';

export class TokenAwardAction extends AdminAction<typeof token_award.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, adminMembership: AdminMembership, private readonly balanceRepository: BalanceRepository) {
        super(adminMembership, token_award, op, data, index);
    }

    override async validate(trx?: Trx) {
        await super.validate(trx);

        if (!this.op.active_auth) {
            throw new ValidationError('Active key is required when awarding tokens.', this, ErrorType.ActiveKeyRequired);
        }

        if (!this.params.from.startsWith('$')) {
            throw new ValidationError('Tokens may only be awarded from a system account.', this, ErrorType.NoSystemAccount);
        }

        const balance = await this.balanceRepository.getBalance(this.params.from, this.params.token, trx);
        if (balance < this.params.qty) {
            throw new ValidationError('Cannot award more than the currently available liquid token balance.', this, ErrorType.InsufficientBalance);
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return await this.balanceRepository.updateBalance(this, this.params.from, this.params.to, this.params.token, this.params.qty, this.action_name, trx);
    }

    override isSupported(): boolean {
        return TokenSupport.canTransfer(SUPPORTED_TOKENS, this.params.token, this.params.qty);
    }
}

const Builder = MakeActionFactory(TokenAwardAction, AdminMembership, BalanceRepository);
export const Router = MakeRouter(token_award.action_name, Builder);
