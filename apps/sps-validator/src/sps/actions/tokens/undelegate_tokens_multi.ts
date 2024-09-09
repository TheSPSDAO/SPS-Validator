import { OperationData, DelegationManager, Action, Trx, EventLog } from '@steem-monsters/splinterlands-validator';
import { undelegate_tokens_multi } from '../schema';
import { Result } from '@steem-monsters/lib-monad';
import { MakeActionFactory, MakeRouter } from '../utils';

export class UndelegateTokensMultiAction extends Action<typeof undelegate_tokens_multi.actionSchema> {
    private readonly toPlayer: string;
    constructor(op: OperationData, data: unknown, index: number, private readonly delegationManager: DelegationManager) {
        super(undelegate_tokens_multi, op, data, index);
        this.toPlayer = this.params.player ?? this.op.account;
    }

    async validate(trx?: Trx) {
        const validationResult = await this.delegationManager.validateUndelegationMulti(
            {
                to: this.toPlayer,
                from: this.params.data.map(({ from, qty }) => [from, qty]),
                token: this.params.token,
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
        this.players.push(this.toPlayer);
        const eventLogs: EventLog[] = [];
        for (const { from, qty } of this.params.data) {
            this.players.push(from);
            const logs = await this.delegationManager.undelegate(
                {
                    to: this.toPlayer,
                    from: from,
                    qty: qty,
                    token: this.params.token,
                    allowSystemAccounts: false,
                },
                this,
                trx,
            );
            eventLogs.push(...logs);
        }
        return eventLogs;
    }
}

const Builder = MakeActionFactory(UndelegateTokensMultiAction, DelegationManager);
export const Router = MakeRouter(undelegate_tokens_multi.action_name, Builder);
