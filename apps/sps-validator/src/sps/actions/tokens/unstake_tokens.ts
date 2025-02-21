import {
    BalanceRepository,
    OperationData,
    TokenSupport,
    TokenUnstakingRepository,
    Action,
    ErrorType,
    ValidationError,
    Trx,
    EventLog,
} from '@steem-monsters/splinterlands-validator';
import { unstake_tokens } from '../schema';
import { SUPPORTED_TOKENS } from '../../features/tokens';
import { MakeActionFactory, MakeRouter } from '../utils';

export class UnstakeTokensAction extends Action<typeof unstake_tokens.actionSchema> {
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly balanceRepository: BalanceRepository,
        private readonly tokenUnstakingRepository: TokenUnstakingRepository,
    ) {
        super(unstake_tokens, op, data, index);
    }

    async validate(trx?: Trx) {
        const staked = TokenSupport.stake(SUPPORTED_TOKENS, this.params.token);
        if (!staked) {
            throw new ValidationError('Unstaking is not supported for the specified token.', this, ErrorType.NoStakingToken);
        }

        if (this.params.qty < 0.04) {
            throw new ValidationError('Minimum unstake amount is 0.04.', this, ErrorType.InvalidUnstakingQty);
        }

        // Check that the player has enough tokens staked in their account
        const balance = await this.balanceRepository.getBalance(this.op.account, staked, trx);

        // NOTE: this code is assuming we can only ever delegate STAKED tokens. This may not be true in the future.
        // example: we use "SPSP" as the token for delegation, but "SPS" as the token for staking. the delegation config
        // is on the "SPSP" token, so we use that to get the delegation config.
        const delegation_support = TokenSupport.delegation(SUPPORTED_TOKENS, staked);
        let unstaking_limit = balance;
        if (delegation_support) {
            const out_balance = await this.balanceRepository.getBalance(this.op.account, delegation_support.out_token, trx);
            unstaking_limit -= out_balance;
        }

        if (unstaking_limit < this.params.qty) {
            throw new ValidationError('Cannot unstake more than the currently available staked token balance.', this, ErrorType.InsufficientBalance);
        }

        // Check if the player already has an active token unstaking in progress
        if (await this.tokenUnstakingRepository.lookup(this.op.account, this.params.token, trx)) {
            throw new ValidationError(
                'There is already an active unstaking process for this player. You must cancel any active unstaking processes before you may start a new one.',
                this,
                ErrorType.ActiveUnstaking,
            );
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        return await this.tokenUnstakingRepository.insert(this, this.params.token, this.params.qty, trx);
    }
}

const Builder = MakeActionFactory(UnstakeTokensAction, BalanceRepository, TokenUnstakingRepository);
export const Router = MakeRouter(unstake_tokens.action_name, Builder);
