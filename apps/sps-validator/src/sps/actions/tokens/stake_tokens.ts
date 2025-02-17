import {
    Action,
    AdminMembership,
    BalanceRepository,
    ErrorType,
    EventLog,
    isSystemAccount,
    OperationData,
    StakingRewardsRepository,
    token,
    TokenSupport,
    Trx,
    ValidationError,
    ValidatorVoteRepository,
} from '@steem-monsters/splinterlands-validator';
import { SUPPORTED_TOKENS } from '../../features/tokens';
import { stake_tokens } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class StakeTokensAction extends Action<typeof stake_tokens.actionSchema> {
    private readonly stakedToken?: token;
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        private readonly stakingRewardsRepository: StakingRewardsRepository,
        private readonly balanceRepository: BalanceRepository,
        private readonly validatorVoteRepository: ValidatorVoteRepository,
        private readonly adminMembership: AdminMembership,
    ) {
        super(stake_tokens, op, data, index);
        this.stakedToken = TokenSupport.stake(SUPPORTED_TOKENS, this.params.token);
    }

    async validate(trx?: Trx) {
        if (!this.stakedToken) {
            throw new ValidationError('Staking is not supported for the specified token.', this, ErrorType.NoStakingToken);
        }

        // If no "to_player" is specified then stake it to the account that sent the transaction
        if (!this.params.to_player) {
            this.params.to_player = this.op.account;
        }
        // If staking to someone else, active key is required because it is essentally a transfer of tokens
        else if (this.params.to_player !== this.op.account && !this.op.active_auth) {
            throw new ValidationError('Active key is required when staking to someone else.', this, ErrorType.ActiveKeyRequired);
        }

        // from_player is guarded by the schema as "SystemAccount only"
        if (!this.params.from_player) {
            this.params.from_player = this.op.account;
        }

        const isFromSystemAccount = isSystemAccount(this.params.from_player);
        const isAdmin = await this.adminMembership.isAdmin(this.op.account);

        if (isFromSystemAccount && !isAdmin) {
            throw new ValidationError('Cannot stake from system account as non admin', this, ErrorType.AdminOnly);
        }

        // Check that they have enough tokens in their account
        const balance = await this.balanceRepository.getBalance(this.params.from_player, this.params.token, trx);
        if (balance < this.params.qty) {
            throw new ValidationError('Cannot stake more than the currently available liquid token balance.', this, ErrorType.InsufficientBalance);
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const logs: EventLog[] = [];
        logs.push(
            ...(await this.stakingRewardsRepository.stakeTokens(
                this,
                this.params.from_player!,
                this.params.to_player!,
                this.params.token,
                this.stakedToken!,
                this.params.qty,
                this.action_name,
                trx,
            )),
        );
        logs.push(...(await this.validatorVoteRepository.incrementVoteWeight(this.params.to_player!, this.params.qty, trx)));
        return logs;
    }
}

const Builder = MakeActionFactory(StakeTokensAction, StakingRewardsRepository, BalanceRepository, ValidatorVoteRepository, AdminMembership);
export const Router = MakeRouter(stake_tokens.action_name, Builder);
