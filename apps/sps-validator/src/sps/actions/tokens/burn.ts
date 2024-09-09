import { Action, BalanceRepository, ErrorType, EventLog, OperationData, Trx, ValidationError } from '@steem-monsters/splinterlands-validator';
import { burn } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class BurnAction extends Action<typeof burn.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly balanceRepository: BalanceRepository) {
        super(burn, op, data, index);
    }

    async validate(trx?: Trx) {
        // Check that the sender has enough tokens in their account
        const balance = await this.balanceRepository.getBalance(this.op.account, this.params.token, trx);

        if (balance < this.params.qty) {
            throw new ValidationError('Insufficient balance.', this, ErrorType.InsufficientBalance);
        }

        if (this.op.account !== this.params.account) {
            throw new ValidationError('Account mismatch balance.', this, ErrorType.MismatchedAccount);
        }
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        // Add the recipient to the list of players affected by this action
        this.players.push(this.params.to);
        return await this.balanceRepository.updateBalance(this, this.op.account, this.params.to, this.params.token, this.params.qty, this.action_name, trx);
    }
}

const Builder = MakeActionFactory(BurnAction, BalanceRepository);
export const Router = MakeRouter(burn.action_name, Builder);
