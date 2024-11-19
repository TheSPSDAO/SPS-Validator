import { OperationData, DelegationManager, Action, Trx, EventLog } from '@steem-monsters/splinterlands-validator';
import { return_tokens } from '../schema';
import { Result } from '@steem-monsters/lib-monad';
import { MakeActionFactory, MakeRouter } from '../utils';

export class ReturnTokensAction extends Action<typeof return_tokens.actionSchema> {
    private readonly fromPlayer: string;
    constructor(op: OperationData, data: unknown, index: number, private readonly delegationManager: DelegationManager) {
        super(return_tokens, op, data, index);
        this.fromPlayer = this.params.player ?? this.op.account;
    }

    async validate(trx?: Trx) {
        const validationResult = await this.delegationManager.validateUndelegation(
            {
                account: this.fromPlayer,
                to: this.params.from,
                from: this.fromPlayer,
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
        this.players.push(this.fromPlayer, this.params.from);
        const eventLogs = await this.delegationManager.undelegate(
            {
                account: this.fromPlayer,
                to: this.params.from,
                from: this.fromPlayer,
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

const Builder = MakeActionFactory(ReturnTokensAction, DelegationManager);
export const Router = MakeRouter(return_tokens.action_name, Builder);
