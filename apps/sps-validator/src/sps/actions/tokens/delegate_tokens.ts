import { OperationData, DelegationManager, Action, Trx, EventLog } from '@steem-monsters/splinterlands-validator';
import { delegate_tokens } from '../schema';
import { Result } from '@steem-monsters/lib-monad';
import { MakeActionFactory, MakeRouter } from '../utils';

export class DelegateTokensAction extends Action<typeof delegate_tokens.actionSchema> {
    private readonly toPlayer: string;
    constructor(op: OperationData, data: unknown, index: number, private readonly delegationManager: DelegationManager) {
        super(delegate_tokens, op, data, index);
        this.toPlayer = this.params.player ?? this.op.account;
    }

    async validate(trx?: Trx) {
        const validation = await this.delegationManager.validateDelegation(
            {
                from: this.toPlayer,
                token: this.params.token,
                to: this.params.to,
                qty: this.params.qty,
                allowSystemAccounts: false,
            },
            this,
            trx,
        );

        if (Result.isErr(validation)) {
            throw validation.error;
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        this.players.push(this.toPlayer, this.params.to);
        const eventLogs = await this.delegationManager.delegate(
            {
                from: this.toPlayer,
                to: this.params.to,
                qty: this.params.qty,
                token: this.params.token,
                allowSystemAccounts: false,
            },
            this,
            trx,
        );
        return eventLogs;
    }
}

const Builder = MakeActionFactory(DelegateTokensAction, DelegationManager);
export const Router = MakeRouter(delegate_tokens.action_name, Builder);
