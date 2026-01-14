import {
    OperationData,
    Action,
    EventLog,
    Trx,
    Handle,
    BaseRepository,
    ValidatorVoteRepository,
    RawResult,
    StakingRewardsRepository,
    BalanceRepository,
    StakingConfiguration,
    token,
} from '@steem-monsters/splinterlands-validator';
import { transition_cleanup_lite_accounts } from '../schema';
import { MakeActionFactory, MakeRouter } from '../utils';
import { TransitionManager } from '../../features/transition';
import { TOKENS } from '../../features/tokens';

type LiteAccountSummary = {
    account: string;
    spsp: number;
    sps: number;
};

class CleanupLiteAccountsRepository extends BaseRepository {
    constructor(handle: Handle) {
        super(handle);
    }

    async getLiteAccounts(trx?: Trx) {
        const results = await this.queryRaw(trx).raw<RawResult<LiteAccountSummary>>(
            `
            SELECT
                accounts.account,
                COALESCE(spsp.balance, 0) AS spsp,
                COALESCE(sps.balance, 0) AS sps
            FROM
                (
                    SELECT DISTINCT
                        player AS account
                    FROM
                        balances
                    WHERE
                        player LIKE '%\\_%'
                        AND player NOT LIKE '$%'
                        AND token IN ('SPS', 'SPSP')
                        AND balance > 0
                ) AS accounts
            LEFT JOIN
                balances spsp ON accounts.account = spsp.player AND spsp.token = 'SPSP' AND spsp.balance > 0
            LEFT JOIN
                balances sps ON accounts.account = sps.player AND sps.token = 'SPS' AND sps.balance > 0
            ORDER BY
                accounts.account DESC
            `,
        );
        return results.rows.map((row) => ({
            account: row.account,
            spsp: parseFloat(row.spsp as unknown as string),
            sps: parseFloat(row.sps as unknown as string),
        }));
    }
}

export class CleanupLiteAccountsTransitionAction extends Action<typeof transition_cleanup_lite_accounts.actionSchema> {
    public static readonly SUPPORT_ACCOUNT = 'sl-cs-lite';

    private readonly token = TOKENS.SPS;
    private readonly stakedToken: token = TOKENS.SPSP;
    private readonly cleanupRepository: CleanupLiteAccountsRepository;

    constructor(
        op: OperationData,
        data: unknown,
        index: number,
        handle: Handle,
        private readonly stakingConfiguration: StakingConfiguration,
        private readonly stakingRepository: StakingRewardsRepository,
        private readonly balanceRepository: BalanceRepository,
        private readonly validatorVoteRepository: ValidatorVoteRepository,
        private readonly transitionManager: TransitionManager,
    ) {
        super(transition_cleanup_lite_accounts, op, data, index);
        this.cleanupRepository = new CleanupLiteAccountsRepository(handle);
    }

    override isSupported(): boolean {
        return this.op.account === this.transitionManager.transitionAccount && this.transitionManager.isTransitionPoint('validator_transition_cleanup', this.op.block_num);
    }

    async validate() {
        return true;
    }

    async process(trx?: Trx): Promise<EventLog[]> {
        const events: EventLog[] = [];
        const liteAccountsInitial = await this.cleanupRepository.getLiteAccounts(trx);

        // First unstake all the SPSP
        const accountsWithSpsp = liteAccountsInitial.filter((account) => account.spsp > 0);
        for (const account of accountsWithSpsp) {
            const unstakeEvents = await this.unstakeSPSP(account.account, account.spsp, trx);
            events.push(...unstakeEvents);
        }

        // Now get the lite account summary again which will have the updated SPS
        const liteAccountsFinal = await this.cleanupRepository.getLiteAccounts(trx);
        // Transfer it all to the sl-cs-lite account
        const accountsWithSps = liteAccountsFinal.filter((account) => account.sps > 0);
        for (const account of accountsWithSps) {
            events.push(
                ...(await this.balanceRepository.updateBalance(
                    this,
                    account.account,
                    CleanupLiteAccountsTransitionAction.SUPPORT_ACCOUNT,
                    this.token,
                    account.sps,
                    'token_transfer',
                    trx,
                )),
            );
        }

        return events;
    }

    private async unstakeSPSP(account: string, amount: number, trx?: Trx): Promise<EventLog[]> {
        const results: EventLog[] = [];

        results.push(...(await this.stakingRepository.claimAll(account, [amount * -1, this.stakedToken!], this, trx)));
        const balanceUpdateType = 'token_unstaking';
        // Deduct the SPSP amount from the player's account
        results.push(...(await this.balanceRepository.updateBalance(this, account, this.stakingConfiguration.staking_account, this.stakedToken!, amount, balanceUpdateType, trx)));
        // Move the liquid SPS tokens from the token staking account to the player's balance
        results.push(...(await this.balanceRepository.updateBalance(this, this.stakingConfiguration.staking_account, account, this.token, amount, balanceUpdateType, trx)));
        // They can't vote but we'll update their vote weight anyway
        results.push(...(await this.validatorVoteRepository.incrementVoteWeight(account, amount * -1, this.op.block_num, trx)));

        return results;
    }
}

const Builder = MakeActionFactory(
    CleanupLiteAccountsTransitionAction,
    Handle,
    StakingConfiguration,
    StakingRewardsRepository,
    BalanceRepository,
    ValidatorVoteRepository,
    TransitionManager,
);
export const Router = MakeRouter(transition_cleanup_lite_accounts.action_name, Builder);
