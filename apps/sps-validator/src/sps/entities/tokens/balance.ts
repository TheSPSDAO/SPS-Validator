import { inject, injectable } from 'tsyringe';
import { BalanceEntity, BalanceHistoryRepository, BalanceRepository, Bookkeeping, Handle, Trx } from '@steem-monsters/splinterlands-validator';
import { TOKENS } from '../../features/tokens';

export type SupplyOpts = {
    burn_account: string;
    burned_ledger_account: string;

    staking_account: string;

    dao_account: string;
    dao_reserve_account: string;
    sl_cold_account: string;

    terablock_bsc_account: string;
    terablock_eth_account: string;

    reward_pool_accounts: string[];
};

export const SupplyOpts = Symbol('SupplyOpts');

export type SupplyEntry = {
    token: string;
    circulating_supply: number;
} & Record<string, unknown>;

@injectable()
export class SpsBalanceRepository extends BalanceRepository {
    public constructor(
        @inject(Handle) handle: Handle,
        @inject(SupplyOpts) private readonly supplyOpts: SupplyOpts,
        @inject(BalanceHistoryRepository) balanceHistory: BalanceHistoryRepository,
        @inject(Bookkeeping) bookkeeping: Bookkeeping,
    ) {
        super(handle, balanceHistory, bookkeeping);
    }

    async getSupply(token: string, trx?: Trx): Promise<SupplyEntry> {
        const query = this.query(BalanceEntity, trx)
            .where('token', token)
            .andWhere('balance', '>', String(0))
            .whereNotIn('player', [this.supplyOpts.burn_account, this.supplyOpts.burned_ledger_account])
            .whereRaw('(player NOT LIKE ? OR player = ?)', '$%', this.supplyOpts.staking_account)
            .sum('balance', 'supply');
        const record = await query.getSingleOrNull();
        if (!record || record.supply === null) {
            return {
                token,
                circulating_supply: 0,
            };
        }
        const supply = parseFloat(record!.supply);
        switch (token) {
            case TOKENS.SPS:
                return this.calculateSpsSupply(supply, trx);
            default:
                return {
                    token,
                    circulating_supply: supply,
                };
        }
    }

    async calculateSpsSupply(supply: number, trx?: Trx): Promise<SupplyEntry> {
        const totalSupplySps = Math.abs(supply);
        const balances = await this.sumMultiBalances(
            {
                [TOKENS.SPS]: [
                    // TODO combine these
                    this.supplyOpts.burn_account,
                    this.supplyOpts.burned_ledger_account,

                    this.supplyOpts.dao_account,
                    this.supplyOpts.dao_reserve_account,
                    this.supplyOpts.sl_cold_account,
                    this.supplyOpts.terablock_bsc_account,
                    this.supplyOpts.terablock_eth_account,

                    ...this.supplyOpts.reward_pool_accounts,
                ],
                [TOKENS.SPSP]: [this.supplyOpts.dao_account, this.supplyOpts.terablock_bsc_account, this.supplyOpts.terablock_eth_account],
            },
            trx,
        );

        const combinedNullSps = balances[this.supplyOpts.burn_account][TOKENS.SPS]! + balances[this.supplyOpts.burned_ledger_account][TOKENS.SPS];
        balances[this.supplyOpts.burn_account][TOKENS.SPS] = combinedNullSps;
        delete balances[this.supplyOpts.burned_ledger_account];

        const combinedDaoSps = balances[this.supplyOpts.dao_account][TOKENS.SPS] + balances[this.supplyOpts.dao_account][TOKENS.SPSP];
        balances[this.supplyOpts.dao_account][TOKENS.SPS] = combinedDaoSps;
        delete balances[this.supplyOpts.dao_account][TOKENS.SPSP];

        const combinedTerablockBscSps = balances[this.supplyOpts.terablock_bsc_account][TOKENS.SPS] + balances[this.supplyOpts.terablock_bsc_account][TOKENS.SPSP];
        balances[this.supplyOpts.terablock_bsc_account][TOKENS.SPS] = combinedTerablockBscSps;
        delete balances[this.supplyOpts.terablock_bsc_account][TOKENS.SPSP];

        const combinedTerablockEthSps = balances[this.supplyOpts.terablock_eth_account][TOKENS.SPS] + balances[this.supplyOpts.terablock_eth_account][TOKENS.SPSP];
        balances[this.supplyOpts.terablock_eth_account][TOKENS.SPS] = combinedTerablockEthSps;
        delete balances[this.supplyOpts.terablock_eth_account][TOKENS.SPSP];

        const daoReserveSps = balances[this.supplyOpts.dao_reserve_account][TOKENS.SPS];
        const slColdSupplySps = balances[this.supplyOpts.sl_cold_account][TOKENS.SPS];
        const circulatingSupplySps = totalSupplySps - combinedDaoSps - daoReserveSps - combinedTerablockBscSps - combinedTerablockEthSps - slColdSupplySps;

        const rewardPoolsSps = Object.entries(balances)
            .filter(([account]) => this.supplyOpts.reward_pool_accounts.includes(account))
            .reduce((acc, [account, b]) => {
                acc[account] = b[TOKENS.SPS];
                return acc;
            }, {} as Record<string, number>);

        return {
            token: TOKENS.SPS,
            minted: totalSupplySps + combinedNullSps,
            burned: combinedNullSps,
            total_supply: totalSupplySps,
            circulating_supply: circulatingSupplySps,
            reserve: {
                dao: combinedDaoSps,
                dao_deserve: daoReserveSps,
                sl_cold: slColdSupplySps,
                terablock_bsc: combinedTerablockBscSps,
                terablock_eth: combinedTerablockEthSps,
            },
            reward_pools: {
                ...rewardPoolsSps,
            },
        };
    }

    private async sumMultiBalances(tokens: Record<string, string[]>, trx?: Trx) {
        const tokensEntries = Object.entries(tokens);

        // set 0 for all requested accounts to handle cases where they dont exist.
        const groupedBalances = tokensEntries.reduce((acc, [token, accounts]) => {
            for (const account of accounts) {
                acc[account] ??= {};
                acc[account][token] = 0;
            }
            return acc;
        }, {} as Record<string, Record<string, number>>);

        // get what we can
        const balances = await Promise.all(tokensEntries.map(([token, accounts]) => this.getMultipleBalancesByToken(token, accounts, trx)));
        return balances
            .flatMap((b) => b)
            .reduce((acc, balance) => {
                acc[balance.player] ??= {};
                acc[balance.player][balance.token] = Math.abs(balance.balance);
                return acc;
            }, groupedBalances);
    }
}
