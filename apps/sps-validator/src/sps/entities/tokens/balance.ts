import { inject, injectable } from 'tsyringe';
import {
    BalanceEntity,
    BalanceEntry,
    BalanceHistoryRepository,
    BalanceRepository,
    Bookkeeping,
    GetTokenBalancesParams,
    GetTokenBalancesResult,
    Handle,
    RawResult,
    Trx,
} from '@steem-monsters/splinterlands-validator';
import { TOKENS, VIRTUAL_TOKENS, VirtualTokenConfig } from '../../features/tokens';
import { BaseERC20Repository, SpsBaseRepository, SpsBscRepository, SpsEthRepository } from './eth';
import { HiveEngineRepository } from './hive_engine';

export type SupplyOpts = {
    burn_account: string;
    burned_ledger_account: string;

    staking_account: string;

    dao_account: string;
    dao_reserve_account: string;
    dao_delegation_account: string;

    bridge_accounts_by_chain: Record<
        'eth' | 'base' | 'bsc' | 'hive',
        {
            excluded_addresses: string[];
            hive_accounts: string[];
        }
    >;

    reward_pool_accounts: string[];
};

export const SupplyOpts = Symbol('SupplyOpts');

export type SupplyEntry = {
    token: string;
    circulating_supply: number;
    total_supply?: number;
} & Record<string, unknown>;

export type GetTokenExtendedBalancesParams = Omit<GetTokenBalancesParams, 'tokens'> & {
    excluded_accounts?: string[];
    token: string;
};

@injectable()
export class SpsBalanceRepository extends BalanceRepository {
    public constructor(
        @inject(Handle) handle: Handle,
        @inject(SupplyOpts) private readonly supplyOpts: SupplyOpts,
        @inject(BalanceHistoryRepository) balanceHistory: BalanceHistoryRepository,
        @inject(Bookkeeping) bookkeeping: Bookkeeping,
        @inject(SpsEthRepository) private readonly ethRepository: SpsEthRepository,
        @inject(SpsBscRepository) private readonly bscRepository: SpsBscRepository,
        @inject(SpsBaseRepository) private readonly baseRepository: SpsBaseRepository,
        @inject(HiveEngineRepository) private readonly hiveEngineRepo: HiveEngineRepository,
        @inject(VirtualTokenConfig) private readonly virtualTokenConfig: VirtualTokenConfig,
    ) {
        super(handle, balanceHistory, bookkeeping);
    }

    async getExtendedBalances(player: string, trx?: Trx): Promise<BalanceEntry[]> {
        const records = await this.query(BalanceEntity, trx).where('player', player).select('player', 'token', 'balance').orderBy('player').orderBy('token').getMany();
        const mappedRecords = records.map(BalanceRepository.into);
        const virtualBalances = Object.entries(this.virtualTokenConfig).map(([token, sourceTokens]) => {
            const sourceBalances = sourceTokens.map((sourceToken) => mappedRecords.find((r) => r.token === sourceToken)?.balance ?? 0);
            return {
                token,
                player,
                balance: sourceBalances.reduce((acc, b) => acc + b, 0),
            };
        });
        return [...mappedRecords, ...virtualBalances];
    }

    async getSpsRichlist(trx?: Trx): Promise<BalanceEntry[]> {
        const result = await this.getTokenExtendedBalances(
            {
                count: false,
                systemAccounts: false,
                limit: 100,
                skip: 0,
                token: VIRTUAL_TOKENS.SPS_TOTAL,
                excluded_accounts: [
                    this.supplyOpts.dao_account,
                    this.supplyOpts.dao_reserve_account,
                    ...Object.entries(this.supplyOpts.bridge_accounts_by_chain).flatMap(([_, config]) => config.hive_accounts),
                ],
            },
            trx,
        );
        return result.balances;
    }

    async getMultipleExtendedBalancesByToken(token: string, players: string[], trx?: Trx): Promise<BalanceEntry[]> {
        const virtualTokenSources = this.virtualTokenConfig[token];
        if (virtualTokenSources) {
            const records = await this.query(BalanceEntity, trx)
                .whereIn('player', players)
                .whereIn('token', virtualTokenSources)
                .groupBy('player')
                .select('player')
                .sum('balance', 'balance')
                .orderBy('player')
                .orderBy('balance')
                .getMany();
            const mappedRecords = records.map((r) => ({
                player: r.player,
                token,
                balance: parseFloat(r.balance),
            }));
            return mappedRecords;
        } else {
            const records = await this.query(BalanceEntity, trx)
                .whereIn('player', players)
                .andWhere('token', token)
                .select('player', 'token', 'balance')
                .orderBy('player')
                .orderBy('token')
                .getMany();
            return records.map(BalanceRepository.into);
        }
    }

    async getTokenExtendedBalances(params: GetTokenExtendedBalancesParams, trx?: Trx): Promise<GetTokenBalancesResult> {
        const tokens = this.virtualTokenConfig[params.token] ?? [params.token];
        let query = this.query(BalanceEntity, trx).whereIn('token', tokens).groupBy('player').sum('balance', 'balance').orderByRaw('balance DESC').select('player');
        const excludeSystemAccounts = params.systemAccounts === false || params.systemAccounts === undefined;
        if (excludeSystemAccounts) {
            query = query.where('player', 'NOT LIKE', '$%');
        }
        const count = params.count ? await this.getPlayerCountForTokens(tokens, excludeSystemAccounts) : undefined;
        if (params.limit === 0 && params.skip === 0) {
            return {
                count,
                balances: [],
            };
        }

        if (params.limit !== undefined) {
            query = query.limit(params.limit);
        }
        if (params.skip !== undefined) {
            query = query.offset(params.skip);
        }
        if (params.excluded_accounts) {
            query = query.whereNotIn('player', params.excluded_accounts);
        }

        const records = await query.getMany();
        const mappedRecords = records.map((r) => ({
            player: r.player,
            token: params.token,
            balance: parseFloat(r.balance),
        }));
        return {
            count,
            balances: mappedRecords,
        };
    }

    private async getPlayerCountForTokens(tokens: string[], excludeSystemAccounts: boolean, trx?: Trx) {
        const raw = await this.queryRaw(trx).raw<RawResult<{ count: string }>>(
            `SELECT COUNT(DISTINCT player) as count FROM balances WHERE token = ANY(?::text[])${excludeSystemAccounts ? " AND player NOT LIKE '$%'" : ''}`,
            [tokens],
        );
        return parseInt(raw.rows[0].count);
    }

    /**
     * do not use this in block processing.
     *
     * todo: move this out of the repository and into features/tokens
     */
    async getSupply(token: string, trx?: Trx): Promise<SupplyEntry> {
        switch (token) {
            case TOKENS.SPS:
                return this.calculateSpsSupply(trx);
            case TOKENS.LICENSE:
                return this.calculateLicenseSupply(trx);
            default: {
                const virtualTokenSources = this.virtualTokenConfig[token];
                if (virtualTokenSources) {
                    const query = this.query(BalanceEntity, trx)
                        .whereIn('token', virtualTokenSources)
                        .whereNotIn('player', [this.supplyOpts.burn_account, this.supplyOpts.burned_ledger_account])
                        .whereRaw('player NOT LIKE ?', '$%')
                        .groupBy('token')
                        .sum('balance', 'balance')
                        .select('token');
                    const records = await query.getMany();
                    const supply = records.reduce((acc, r) => acc + parseFloat(r.balance), 0);
                    return {
                        token,
                        circulating_supply: supply,
                        ...records.reduce((acc, r) => {
                            acc[r.token] = parseFloat(r.balance);
                            return acc;
                        }, {} as Record<string, number>),
                    };
                } else {
                    const query = this.query(BalanceEntity, trx)
                        .where('token', token)
                        .andWhere('balance', '>', String(0))
                        .whereNotIn('player', [this.supplyOpts.burn_account, this.supplyOpts.burned_ledger_account])
                        .whereRaw('player NOT LIKE ?', '$%')
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
    }

    private async calculateLicenseSupply(trx?: Trx): Promise<SupplyEntry> {
        // this is a hack - the shop account name is stored per shop item and its hard to get here.
        // just going to hardcode it for now.
        const shopSupply = await this.sumMultiBalances(
            {
                [TOKENS.LICENSE]: ['$SHOP'],
            },
            trx,
        );
        const totalLicenses = await this.sumPlayerBalances([TOKENS.LICENSE], trx);
        const activatedLicenses = await this.sumPlayerBalances([TOKENS.ACTIVATED_LICENSE], trx);
        const runningLicenses = await this.sumPlayerBalances([TOKENS.RUNNING_LICENSE], trx);
        const circulatingLicenses = totalLicenses + activatedLicenses;
        const shopLicenses = shopSupply['$SHOP'][TOKENS.LICENSE] ?? 0;
        return {
            token: TOKENS.LICENSE,
            minted: circulatingLicenses + shopLicenses,
            burned: 0,
            total_supply: totalLicenses + shopLicenses,
            circulating_supply: circulatingLicenses,
            shop_supply: shopLicenses,
            running_licenses: runningLicenses,
        };
    }

    private async calculateSpsSupply(trx?: Trx): Promise<SupplyEntry> {
        const supply = await this.sumPlayerBalances([TOKENS.SPS, TOKENS.SPSP], trx);
        const totalSupplySps = Math.abs(supply);
        const balances = await this.sumMultiBalances(
            {
                [TOKENS.SPS]: [
                    // TODO combine these
                    this.supplyOpts.burn_account,
                    this.supplyOpts.burned_ledger_account,

                    this.supplyOpts.dao_account,
                    this.supplyOpts.dao_reserve_account,
                    this.supplyOpts.dao_delegation_account,
                    ...Object.values(this.supplyOpts.bridge_accounts_by_chain).flatMap((b) => b.hive_accounts),

                    ...this.supplyOpts.reward_pool_accounts,
                ],
                [TOKENS.SPSP]: [
                    this.supplyOpts.staking_account,
                    this.supplyOpts.dao_account,
                    this.supplyOpts.dao_delegation_account,
                    ...Object.values(this.supplyOpts.bridge_accounts_by_chain).flatMap((b) => b.hive_accounts),
                ],
            },
            trx,
        );

        const combinedNullSps = balances[this.supplyOpts.burn_account][TOKENS.SPS]! + balances[this.supplyOpts.burned_ledger_account][TOKENS.SPS];
        balances[this.supplyOpts.burn_account][TOKENS.SPS] = combinedNullSps;
        delete balances[this.supplyOpts.burned_ledger_account];

        const combinedDaoSps = balances[this.supplyOpts.dao_account][TOKENS.SPS] + balances[this.supplyOpts.dao_account][TOKENS.SPSP];
        balances[this.supplyOpts.dao_account][TOKENS.SPS] = combinedDaoSps;
        delete balances[this.supplyOpts.dao_account][TOKENS.SPSP];

        const bridgeAccountBalances = Object.entries(this.supplyOpts.bridge_accounts_by_chain).map(([chain, config]) => {
            const byAccount = Object.fromEntries(config.hive_accounts.map((account) => [account, Object.values(balances[account]).reduce((sum, v) => sum + v, 0)]));
            const balance = Object.values(byAccount).reduce((sum, v) => sum + v, 0);
            // probably dont need to delete these, but just to keep them out of the response we will
            for (const account of config.hive_accounts) {
                delete balances[account][TOKENS.SPSP];
            }
            return { chain, byAccount, balance };
        });
        const totalBridgeAccountBalances = bridgeAccountBalances.reduce((acc, b) => acc + b.balance, 0);

        const daoReserveSps = balances[this.supplyOpts.dao_reserve_account][TOKENS.SPS];
        const daoDelegationSps = balances[this.supplyOpts.dao_delegation_account][TOKENS.SPS] + balances[this.supplyOpts.dao_delegation_account][TOKENS.SPSP];
        const totalStaked = Math.abs(await balances[this.supplyOpts.staking_account][TOKENS.SPSP]);

        const offChainBalances = {
            hive_engine: await this.calculateHiveEngineSupply(this.supplyOpts.bridge_accounts_by_chain.hive.excluded_addresses),
            eth: await this.calculateErc20Supply(this.ethRepository, this.supplyOpts.bridge_accounts_by_chain.eth.excluded_addresses),
            bsc: await this.calculateErc20Supply(this.bscRepository, this.supplyOpts.bridge_accounts_by_chain.bsc.excluded_addresses),
            base: await this.calculateErc20Supply(this.baseRepository, this.supplyOpts.bridge_accounts_by_chain.base.excluded_addresses),
        };
        const offChainSupply = Object.values(offChainBalances).reduce((acc, b) => acc + b.circulating_supply, 0);

        const circulatingSupplySps = totalSupplySps - combinedDaoSps - daoReserveSps - daoDelegationSps - totalBridgeAccountBalances + offChainSupply;

        const rewardPoolSupply = Object.entries(balances)
            .filter(([account]) => this.supplyOpts.reward_pool_accounts.includes(account))
            .reduce((acc, [_, b]) => acc + b[TOKENS.SPS], 0);
        const rewardPoolsSps = Object.entries(balances)
            .filter(([account]) => this.supplyOpts.reward_pool_accounts.includes(account))
            .reduce((acc, [account, b]) => {
                acc[account] = b[TOKENS.SPS];
                return acc;
            }, {} as Record<string, number>);

        const unstaking = await this.sumUnstaking(TOKENS.SPS, trx);

        return {
            token: TOKENS.SPS,
            minted: Math.floor(totalSupplySps + combinedNullSps + rewardPoolSupply),
            burned: combinedNullSps,
            total_staked: totalStaked,
            total_supply: totalSupplySps + rewardPoolSupply,
            circulating_supply: circulatingSupplySps,
            unstaking,
            off_chain: {
                total: offChainSupply,
                ...Object.fromEntries(Object.entries(offChainBalances).map(([k, v]) => [k, v.circulating_supply])),
            },
            reserve: {
                total: combinedDaoSps + daoReserveSps + daoDelegationSps + totalBridgeAccountBalances,
                [this.supplyOpts.dao_account]: combinedDaoSps,
                [this.supplyOpts.dao_reserve_account]: daoReserveSps,
                [this.supplyOpts.dao_delegation_account]: totalStaked,
                ...Object.fromEntries(bridgeAccountBalances.map((b) => [`${b.chain}_bridges`, b.balance])),
            },
            bridges: Object.fromEntries(bridgeAccountBalances.map((b) => [b.chain, b.byAccount])),
            reward_pools: {
                total: rewardPoolSupply,
                ...rewardPoolsSps,
            },
        };
    }

    private async sumUnstaking(token: string, trx?: Trx) {
        const pendingUnstakeRows = await this.queryRaw(trx).raw<RawResult<{ pending_unstake: string; pending_immediate_unstake: string }>>(
            `
                SELECT
                  SUM(total_qty - total_unstaked) as pending_unstake,
                  SUM(
                    LEAST(ABS(total_qty - total_unstaked), ABS(total_qty / unstaking_periods))
                  ) as pending_immediate_unstake
                FROM
                  token_unstaking
                WHERE
                    token = ?
                    AND is_active = true
            `,
            [token],
        );
        const row = pendingUnstakeRows.rows[0] ?? { pending_unstake: 0, pending_immediate_unstake: 0 };
        return {
            pending_unstake: +parseFloat(row.pending_unstake).toFixed(3),
            pending_immediate_unstake: +parseFloat(row.pending_immediate_unstake).toFixed(3),
        };
    }

    private async sumPlayerBalances(tokens: string[], trx?: Trx) {
        const query = this.query(BalanceEntity, trx)
            .whereIn('token', tokens)
            .andWhere('balance', '>', String(0))
            .whereNotIn('player', [this.supplyOpts.burn_account, this.supplyOpts.burned_ledger_account])
            .whereRaw("player NOT LIKE '$%'")
            .sum('balance', 'supply');
        const record = await query.getSingleOrNull();
        if (!record || record.supply === null) {
            return 0;
        }
        return parseFloat(record.supply);
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

    private async calculateHiveEngineSupply(excluded_accounts: string[]) {
        const totalSupply = await this.hiveEngineRepo.getCirculatingSupply(TOKENS.SPS);
        const excludedBalances = await Promise.all(excluded_accounts.map((account) => this.hiveEngineRepo.getBalance(account, TOKENS.SPS)));
        const circulatingSupply = totalSupply - excludedBalances.reduce((acc, b) => acc + b, 0);
        return {
            total_supply: this.roundToPlaces(totalSupply, 3),
            circulating_supply: this.roundToPlaces(circulatingSupply, 3),
        };
    }

    private async calculateErc20Supply(repository: BaseERC20Repository, excluded_addresses: string[]) {
        const totalSupply = await repository.getSupply();
        const excludedBalances = await Promise.all(excluded_addresses.map((address) => repository.getBalance(address)));
        const circulatingSupply = totalSupply - excludedBalances.reduce((acc, balance) => acc + balance, 0);
        return {
            total_supply: this.roundToPlaces(totalSupply, 3),
            circulating_supply: this.roundToPlaces(circulatingSupply, 3),
        };
    }

    private roundToPlaces(num: number, places: number) {
        const factor = 10 ** places;
        return Math.round(num * factor) / factor;
    }
}
