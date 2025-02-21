import {
    AdminAction,
    AdminMembership,
    BalanceRepository,
    ErrorType,
    EventLog,
    OperationData,
    StakingRewardsRepository,
    token,
    TokenSupport,
    Trx,
    ValidationError,
    ValidatorVoteRepository,
} from '@steem-monsters/splinterlands-validator';
import { SUPPORTED_TOKENS } from '../../features/tokens';
import { stake_tokens_multi } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';

export class StakeTokensMultiAction extends AdminAction<typeof stake_tokens_multi.actionSchema> {
    private readonly stakedToken?: token;
    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        adminMembership: AdminMembership,
        private readonly stakingRewardsRepository: StakingRewardsRepository,
        private readonly balanceRepository: BalanceRepository,
        private readonly validatorVoteRepository: ValidatorVoteRepository,
    ) {
        super(adminMembership, stake_tokens_multi, op, data, index);
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

        // group transfers by from account because we could have multiple transfers from the same account within the array
        const groupedTransfers = this.params.multi.reduce((acc, cur) => {
            if (!acc[cur.from]) {
                acc[cur.from] = 0;
            }
            acc[cur.from] += cur.qty;
            return acc;
        }, {} as Record<string, number>);

        // check that the accounts have enough tokens
        for (const [from, qty] of Object.entries(groupedTransfers)) {
            const balance = await this.balanceRepository.getBalance(from, this.params.token, trx);
            if (balance < qty) {
                throw new ValidationError('Cannot stake more than the currently available liquid token balance.', this, ErrorType.InsufficientBalance);
            }
        }

        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const logs: EventLog[] = [];
        const totalQty = this.params.multi.reduce((acc, cur) => acc + cur.qty, 0);
        logs.push(...(await this.stakingRewardsRepository.claimUnclaimedRewards(this, this.params.to_player!, this.stakedToken!, totalQty, trx)));
        for (const { qty, from } of this.params.multi) {
            logs.push(
                ...(await this.stakingRewardsRepository.updatedBalancesAfterStaking(
                    this,
                    from,
                    this.params.to_player!,
                    this.params.token,
                    this.stakedToken!,
                    qty,
                    this.action_name,
                    trx,
                )),
            );
        }
        logs.push(...(await this.validatorVoteRepository.incrementVoteWeight(this.params.to_player!, totalQty, trx)));
        return logs;
    }
}

const Builder = MakeActionFactory(StakeTokensMultiAction, AdminMembership, StakingRewardsRepository, BalanceRepository, ValidatorVoteRepository);
export const Router = MakeRouter(stake_tokens_multi.action_name, Builder);
