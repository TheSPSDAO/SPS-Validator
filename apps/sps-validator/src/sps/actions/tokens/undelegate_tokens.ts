import { OperationData, DelegationManager, Action, Trx, EventLog } from '@steem-monsters/splinterlands-validator';
import { undelegate_tokens } from '../schema';
import { Result } from '@steem-monsters/lib-monad';
import { MakeActionFactory, MakeRouter } from '../utils';

export class UndelegateTokensAction extends Action<typeof undelegate_tokens.actionSchema> {
    private readonly toPlayer: string;
    constructor(op: OperationData, data: unknown, index: number, private readonly delegationManager: DelegationManager) {
        super(undelegate_tokens, op, data, index);
        this.toPlayer = this.params.player ?? this.op.account;
    }

    async validate(trx?: Trx) {
        const validationResult = await this.delegationManager.validateUndelegation(
            {
                to: this.toPlayer, // to is the delegator
                from: this.params.from,
                token: this.params.token,
                qty: this.params.qty,
                allowSystemAccounts: false,
            },
            this,
            trx,
        );

        if (Result.isErr(validationResult)) {
            throw validationResult.error;
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        this.players.push(this.toPlayer, this.params.from);
        const eventLogs = await this.delegationManager.undelegate(
            {
                to: this.toPlayer,
                from: this.params.from,
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

const Builder = MakeActionFactory(UndelegateTokensAction, DelegationManager);
export const Router = MakeRouter(undelegate_tokens.action_name, Builder);
