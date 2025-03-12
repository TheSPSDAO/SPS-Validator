import { inject, injectable } from 'tsyringe';
import { BalanceEntity, BalanceHistoryRepository, BalanceRepository, Bookkeeping, Handle, HiveClient, Trx } from '@steem-monsters/splinterlands-validator';
import { TOKENS } from '../../features/tokens';
import { BaseERC20Repository, SpsBscRepository, SpsEthRepository } from './eth';
import { HiveEngineRepository } from './hive_engine';

export type SupplyOpts = {
    burn_account: string;
    burned_ledger_account: string;

    staking_account: string;

    dao_account: string;
    dao_reserve_account: string;
    sl_hive_account: string;

    terablock_bsc_account: string;
    terablock_eth_account: string;

    hive_supply_exclusion_accounts: string[];
    eth_supply_exclusion_addresses: string[];
    bsc_supply_exclusion_addresses: string[];

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
        @inject(SpsEthRepository) private readonly ethRepository: SpsEthRepository,
        @inject(SpsBscRepository) private readonly bscRepository: SpsBscRepository,
        @inject(HiveEngineRepository) private readonly hiveEngineRepo: HiveEngineRepository,
    ) {
        super(handle, balanceHistory, bookkeeping);
    }

    /**
     * do not use this in block processing.
     */
    async getSupply(token: string, trx?: Trx): Promise<SupplyEntry> {
        switch (token) {
            case TOKENS.SPS:
                return this.calculateSpsSupply(trx);
            default: {
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
                return {
                    token,
                    circulating_supply: supply,
                };
            }
        }
    }

    private async calculateSpsSupply(trx?: Trx): Promise<SupplyEntry> {
        const query = this.query(BalanceEntity, trx)
            .whereIn('token', [TOKENS.SPS, TOKENS.SPSP])
            .andWhere('balance', '>', String(0))
            .whereNotIn('player', [this.supplyOpts.burn_account, this.supplyOpts.burned_ledger_account])
            .whereRaw("player NOT LIKE '$%'")
            .sum('balance', 'supply');
        const record = await query.getSingleOrNull();
        if (!record || record.supply === null) {
            return {
                token: TOKENS.SPS,
                circulating_supply: 0,
            };
        }
        const totalSupplySps = Math.abs(parseFloat(record.supply));
        const balances = await this.sumMultiBalances(
            {
                [TOKENS.SPS]: [
                    // TODO combine these
                    this.supplyOpts.burn_account,
                    this.supplyOpts.burned_ledger_account,

                    this.supplyOpts.dao_account,
                    this.supplyOpts.dao_reserve_account,
                    this.supplyOpts.sl_hive_account,
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
        const slHiveSupplySps = balances[this.supplyOpts.sl_hive_account][TOKENS.SPS];

        const heSupply = await this.calculateHiveEngineSupply();
        const ethSupply = await this.calculateEcr20Supply(this.ethRepository, this.supplyOpts.eth_supply_exclusion_addresses);
        const bscSupply = await this.calculateEcr20Supply(this.bscRepository, this.supplyOpts.bsc_supply_exclusion_addresses);

        const circulatingSupplySps =
            totalSupplySps -
            combinedDaoSps -
            daoReserveSps -
            combinedTerablockBscSps -
            combinedTerablockEthSps -
            slHiveSupplySps +
            ethSupply.actual_supply +
            bscSupply.actual_supply +
            heSupply.actual_supply;

        const rewardPoolSupply = Object.entries(balances)
            .filter(([account]) => this.supplyOpts.reward_pool_accounts.includes(account))
            .reduce((acc, [_, b]) => acc + b[TOKENS.SPS], 0);
        const rewardPoolsSps = Object.entries(balances)
            .filter(([account]) => this.supplyOpts.reward_pool_accounts.includes(account))
            .reduce((acc, [account, b]) => {
                acc[account] = b[TOKENS.SPS];
                return acc;
            }, {} as Record<string, number>);

        return {
            token: TOKENS.SPS,
            minted: Math.floor(totalSupplySps + combinedNullSps + rewardPoolSupply),
            burned: combinedNullSps,
            total_supply: totalSupplySps + rewardPoolSupply,
            circulating_supply: circulatingSupplySps,
            off_chain: {
                hive_engine: heSupply.actual_supply,
                eth: ethSupply.actual_supply,
                bsc: bscSupply.actual_supply,
            },
            reserve: {
                dao: combinedDaoSps,
                dao_reserve: daoReserveSps,
                terablock_bsc: combinedTerablockBscSps,
                terablock_eth: combinedTerablockEthSps,
            },
            reward_pools: {
                total: rewardPoolSupply,
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

    private async calculateHiveEngineSupply() {
        const circulatingSupply = await this.hiveEngineRepo.getCirculatingSupply(TOKENS.SPS);
        const excludedBalances = await Promise.all(this.supplyOpts.hive_supply_exclusion_accounts.map((account) => this.hiveEngineRepo.getBalance(account, TOKENS.SPS)));
        const actualSupply = circulatingSupply - excludedBalances.reduce((acc, b) => acc + b, 0);
        return {
            circulating_supply: this.roundToPlaces(circulatingSupply, 3),
            actual_supply: this.roundToPlaces(actualSupply, 3),
        };
    }

    private async calculateEcr20Supply(repository: BaseERC20Repository, excluded_addresses: string[]) {
        const circulatingSupply = await repository.getSupply();
        const excludedBalances = await Promise.all(excluded_addresses.map((address) => repository.getBalance(address)));
        const actualSupply = circulatingSupply - excludedBalances.reduce((acc, balance) => acc + balance, 0);
        return {
            circulating_supply: this.roundToPlaces(circulatingSupply, 3),
            actual_supply: this.roundToPlaces(actualSupply, 3),
        };
    }

    private roundToPlaces(num: number, places: number) {
        const factor = 10 ** places;
        return Math.round(num * factor) / factor;
    }
}
