import { OperationData, TokenSupport, TokenUnstakingRepository, Action, Trx, ValidationError, ErrorType, EventLog } from '@steem-monsters/splinterlands-validator';
import { cancel_unstake_tokens } from '../schema';
import { SUPPORTED_TOKENS } from '../../features/tokens';
import { MakeActionFactory, MakeRouter } from '../utils';

export class CancelUnstakeTokensAction extends Action<typeof cancel_unstake_tokens.actionSchema> {
    constructor(op: OperationData, data: unknown, index: number, private readonly tokenUnstakingRepository: TokenUnstakingRepository) {
        super(cancel_unstake_tokens, op, data, index);
    }

    async validate(trx?: Trx) {
        const stake = TokenSupport.stake(SUPPORTED_TOKENS, this.params.token);
        if (!stake) {
            throw new ValidationError('Staking is not supported for the specified token.', this, ErrorType.NoStakingToken);
        }

        // Check if the player has an active token unstaking in progress
        if (!(await this.tokenUnstakingRepository.lookup(this.op.account, this.params.token, trx))) {
            throw new ValidationError('This player does not have a currently active unstaking operation to cancel.', this, ErrorType.NoActiveUnstaking);
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return [await this.tokenUnstakingRepository.cancel(this, this.params.token, trx)];
    }
}

const Builder = MakeActionFactory(CancelUnstakeTokensAction, TokenUnstakingRepository);
export const Router = MakeRouter(cancel_unstake_tokens.action_name, Builder);
