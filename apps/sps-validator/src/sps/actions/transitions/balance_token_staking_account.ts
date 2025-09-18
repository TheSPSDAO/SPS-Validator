import {
    OperationData,
    Action,
    EventLog,
    Trx,
    Handle,
    BaseRepository,
    RawResult,
    BalanceRepository,
    StakingConfiguration,
    token,
    ValidationError,
    ErrorType,
} from '@steem-monsters/splinterlands-validator';
import { transition_balance_token_staking_spsp } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { TransitionManager } from '../../features/transition';
import { TOKENS } from '../../features/tokens';

class BalanceTokenStakingAccountRepository extends BaseRepository {
    constructor(handle: Handle) {
        super(handle);
    }

    async getStakingAccountDifference(trx?: Trx) {
        // the sum of the SPSP held by all players + the SPSP held in the staking account should equal 0
        // it does not.
        const result = await this.queryRaw(trx).raw<RawResult<{ spsp_difference: number | string }>>(
            `
            select
                (
                SELECT
                    SUM(balance)
                FROM
                    balances
                WHERE token = 'SPSP' AND player NOT LIKE '$%' AND player != 'null'
                )
                +
                (
                SELECT
                    balance
                FROM
                    balances
                WHERE token = 'SPSP' AND player = '$TOKEN_STAKING'
            ) AS spsp_difference
            `,
        );
        return result.rows.length === 1 ? Number(result.rows[0].spsp_difference) : 0;
    }
}

export class BalanceTokenStakingAccountTransitionAction extends Action<typeof transition_balance_token_staking_spsp.actionSchema> {
    public static readonly SPS_FROM_ACCOUNT = 'sl-cs-admin';

    private readonly token: token = TOKENS.SPS;
    private readonly stakedToken: token = TOKENS.SPSP;
    private readonly balanceTokenStakingAccountRepository: BalanceTokenStakingAccountRepository;

    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        handle: Handle,
        private readonly stakingConfiguration: StakingConfiguration,
        private readonly balanceRepository: BalanceRepository,
        private readonly transitionManager: TransitionManager,
    ) {
        super(transition_balance_token_staking_spsp, op, data, index);
        this.balanceTokenStakingAccountRepository = new BalanceTokenStakingAccountRepository(handle);
    }

    override isSupported(): boolean {
        return this.op.account === this.transitionManager.transitionAccount && this.transitionManager.isTransitionPoint('validator_transition_cleanup', this.op.block_num);
    }

    async validate() {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const events: EventLog[] = [];

        // The sum of all players SPSP staked should equal the balance of the staking account
        // Right now it does not. We are going to move 571,849.75 SPS to the staking account
        // from a splinterlands account that has been holding it for this purpose.
        // After that, we need to adjust the staking accounts SPSP balance down the same amount.
        const difference = await this.balanceTokenStakingAccountRepository.getStakingAccountDifference(trx);
        // these cases shouldn't happen, but just in case
        if (difference === 0) {
            return events;
        } else if (difference < 0) {
            throw new ValidationError(
                `The staking account's abs SPSP balance '${Math.abs(difference)}' is greater than the sum of all players. This is an invalid state.`,
                this,
                ErrorType.TransitionStateInvalid,
            );
        }

        // move the SPS to the staking account
        events.push(
            ...(await this.balanceRepository.updateBalance(
                this,
                BalanceTokenStakingAccountTransitionAction.SPS_FROM_ACCOUNT,
                this.stakingConfiguration.staking_account,
                this.token,
                difference,
                'validator_transition_cleanup',
                trx,
            )),
        );

        // now adjust the staking account's SPSP down the same amount by sending it to null
        events.push(
            ...(await this.balanceRepository.updateBalance(
                this,
                this.stakingConfiguration.staking_account,
                'null',
                this.stakedToken,
                difference,
                'validator_transition_cleanup',
                trx,
            )),
        );

        return events;
    }
}

const Builder = MakeActionFactory(BalanceTokenStakingAccountTransitionAction, Handle, StakingConfiguration, BalanceRepository, TransitionManager);
export const Router = MakeRouter(transition_balance_token_staking_spsp.action_name, Builder);
