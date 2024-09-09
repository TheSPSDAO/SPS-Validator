import {
    BalanceRepository,
    OperationData,
    StakingRewardsRepository,
    TokenSupport,
    ValidatorVoteRepository,
    StakingConfiguration,
    Action,
    token,
    ErrorType,
    ValidationError,
    EventLog,
    Trx,
} from '@steem-monsters/splinterlands-validator';
import { SUPPORTED_TOKENS, TOKENS } from '../../features/tokens';
import { token_unstaking } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class TokenUnstakingAction extends Action<typeof token_unstaking.actionSchema> {
    private readonly stakedToken?: token;

    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly stakingConfiguration: StakingConfiguration,
        private readonly balanceRepository: BalanceRepository,
        private readonly validatorVoteRepository: ValidatorVoteRepository,
        private readonly stakingRewardsRepository: StakingRewardsRepository,
    ) {
        super(token_unstaking, op, data, index);
        this.stakedToken = TokenSupport.stake(SUPPORTED_TOKENS, this.params.token);
    }

    async validate(_trx?: Trx) {
        if (!this.stakedToken) {
            throw new ValidationError('Staking is not supported for the specified token.', this, ErrorType.NoStakingToken);
        }
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        if (!this.stakedToken) {
            throw new ValidationError('Staking is not supported for the specified token.', this, ErrorType.NoStakingToken);
        }
        // Claim any unclaimed staking rewards from the pool before reducing the staked amount
        const results: EventLog[] = await this.stakingRewardsRepository.claimAll(this.params.player, [this.params.unstake_amount * -1, this.stakedToken!], this, trx);

        const amount_remaining = await this.balanceRepository.getBalance(this.params.player, this.stakedToken, trx);

        const unstake_amount = Math.min(this.params.unstake_amount, amount_remaining);

        if (unstake_amount > 0) {
            // Deduct the SPSP amount from the player's account
            results.push(
                ...(await this.balanceRepository.updateBalance(
                    this,
                    this.params.player,
                    this.stakingConfiguration.staking_account,
                    this.stakedToken,
                    unstake_amount,
                    this.action_name,
                    trx,
                )),
            );

            // Move the liquid SPS tokens from the token staking account to the player's balance
            results.push(
                ...(await this.balanceRepository.updateBalance(
                    this,
                    this.stakingConfiguration.staking_account,
                    this.params.player,
                    this.params.token,
                    unstake_amount,
                    this.action_name,
                    trx,
                )),
            );

            // TODO: Refactor this once vote weight calculation is decoupled from SPS.
            if (this.params.token === TOKENS.SPS && this.stakedToken === TOKENS.SPS) {
                // Update the total votes for all validators voted on by this player now that their staked SPS has decreased
                results.push(...(await this.validatorVoteRepository.updateVoteWeight(this.params.player, unstake_amount * -1, trx)));
            }
        }

        await this.params.update(trx);

        return results;
    }
}

const Builder = MakeActionFactory(TokenUnstakingAction, StakingConfiguration, BalanceRepository, ValidatorVoteRepository, StakingRewardsRepository);
export const Router = MakeRouter(token_unstaking.action_name, Builder);
