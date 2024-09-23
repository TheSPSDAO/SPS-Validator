import { Router } from 'express';
import { BalanceRepository } from '../entities/tokens/balance';
import { ValidatorRepository } from '../entities/validator/validator';
import { ValidatorVoteRepository } from '../entities/validator/validator_vote';
import { enableHealthChecker } from './health';
import { TransactionRepository_ } from '../repositories/transactions';
import { Trx } from '../db/tables';
import { PriceFeedConsumer, PriceFeedError } from '../utilities/price_feed';
import { LastBlockCache } from '../entities/block';
import { StakingRewardsRepository } from '../entities/tokens/staking_rewards';
import { Middleware } from './middleware';
import { TransactionMode, TransactionStarter } from '../db/transaction';
import { Resolver } from '../utilities/dependency-injection';
import { isStringArray } from '../utilities/guards';
import { PoolsHelper } from '../config';
import { Shop } from '../libs/shop';

type ApiOptions = {
    health_checker: boolean;
    injection_middleware: Middleware;
    resolver: Resolver;
};

export function registerApiRoutes(app: Router, opts: ApiOptions): void {
    const { health_checker, injection_middleware, resolver } = opts;
    // Register middleware doing DI in requests. Also makes sure we see consistent, filled caches.
    app.use(injection_middleware.attachResolver(resolver));
    if (health_checker) {
        enableHealthChecker(app);
    }

    // Get the current status of the validator node
    app.get('/status', async (req, res) => {
        const lastBlockCache = req.resolver.resolve<LastBlockCache>(LastBlockCache);
        res.json({
            status: 'running',
            last_block: lastBlockCache.value?.block_num || 0,
        });
    });

    app.get('/shop/:saleName', async (req, res) => {
        const { saleName } = req.params;
        const trxStarter = req.resolver.resolve(TransactionStarter);
        const licenseShop = req.resolver.resolve<Shop<Trx>>(Shop);

        if (licenseShop.hasEntry(saleName)) {
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                try {
                    const info = await licenseShop.currentSupply(saleName, trx);
                    if (info) {
                        res.status(200).json(info);
                    } else {
                        res.status(404).end();
                    }
                } catch (e: unknown) {
                    res.status(503).end();
                }
            });
        } else {
            res.status(404).end();
        }
    });

    // Get token balances for a specified account name
    app.get('/balances', async (req, res) => {
        const account = typeof req.query.account === 'string' ? req.query.account : undefined;
        if (account === undefined) {
            res.status(400).end();
            return;
        }

        const trxStarter = req.resolver.resolve(TransactionStarter);
        const Balance = req.resolver.resolve(BalanceRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            res.json(await Balance.getBalances(account, trx));
        });
    });

    // Get token balances for up to 100 accounts
    app.get('/:token/balances', async (req, res) => {
        const MAX = 100;
        const accounts = typeof req.query.accounts === 'string' ? req.query.accounts.split(',').slice(0, MAX) : [];
        const token = typeof req.params.token === 'string' ? req.params.token.toUpperCase() : undefined;
        if (accounts.length <= 0 || !token) {
            res.status(400).end();
            return;
        }

        const trxStarter = req.resolver.resolve(TransactionStarter);
        const Balance = req.resolver.resolve(BalanceRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            res.json(await Balance.getMultipleBalancesByToken(token, accounts, trx));
        });
    });

    // Get the current list of SPS validators
    app.get('/validators', async (req, res) => {
        const trxStarter = req.resolver.resolve(TransactionStarter);
        const Validator = req.resolver.resolve(ValidatorRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            res.json(await Validator.getValidators(trx));
        });
    });

    // Get the list of validators that the specified account votes on
    app.get('/votes_by_account', async (req, res) => {
        const trxStarter = req.resolver.resolve(TransactionStarter);
        const ValidatorVote = req.resolver.resolve(ValidatorVoteRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            res.json(await ValidatorVote.lookupByVoter(req.query.account as string, trx));
        });
    });

    // Get the list of acconts voting for the specified validator
    app.get('/votes_by_validator', async (req, res) => {
        const trxStarter = req.resolver.resolve(TransactionStarter);
        const ValidatorVote = req.resolver.resolve(ValidatorVoteRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            res.json(await ValidatorVote.lookupByValidator(req.query.validator as string, trx));
        });
    });

    app.get('/pool/:poolName', async (req, res) => {
        const { poolName } = req.params;
        const poolsHelper = req.resolver.resolve(PoolsHelper);
        if (!poolsHelper.isPool(poolName)) {
            res.status(404).end();
            return;
        }
        const trxStarter = req.resolver.resolve(TransactionStarter);
        const StakingRewards = req.resolver.resolve(StakingRewardsRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            const params = await StakingRewards.getPoolParameters(poolName, trx);
            if (params !== null) {
                res.status(200).json(params);
            } else {
                // No record for this pool, that should have records; transient error due to broken db config?
                res.status(503).end();
            }
        });
    });

    app.get('/pool/:poolName/reward_debt', async (req, res) => {
        const { poolName } = req.params;
        const poolsHelper = req.resolver.resolve(PoolsHelper);
        if (!poolsHelper.isPool(poolName)) {
            res.status(404).end();
            return;
        }

        const account = typeof req.query.account === 'string' ? req.query.account : undefined;
        if (account === undefined) {
            res.status(400).end();
            return;
        }

        const trxStarter = req.resolver.resolve(TransactionStarter);
        const StakingRewards = req.resolver.resolve(StakingRewardsRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            const debt = await StakingRewards.getRewardDebt(poolName, account, trx);
            // Not currently possible to be undefined due to defaults chosen elsewhere
            if (debt !== undefined) {
                res.status(200).json(debt);
            } else {
                // No record for this player + pool_name: send empty response
                res.status(204).end();
            }
        });
    });

    app.get('/pool/:poolName/account_info', async (req, res) => {
        const { poolName } = req.params;
        const poolsHelper = req.resolver.resolve(PoolsHelper);
        if (!poolsHelper.isPool(poolName)) {
            res.status(404).end();
            return;
        }

        const account = typeof req.query.account === 'string' ? req.query.account : undefined;
        if (account === undefined) {
            res.status(400).end();
            return;
        }

        const trxStarter = req.resolver.resolve(TransactionStarter);
        const StakingRewards = req.resolver.resolve(StakingRewardsRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            const debt = await StakingRewards.getAccountStakedInfo(poolName, account, trx);
            // Not currently possible to be undefined due to defaults chosen elsewhere
            if (debt !== undefined) {
                res.status(200).json(debt);
            } else {
                // TODO this doesn't happen because of the repository - but confirm before removing.
                // No record for this player + pool_name: send empty response
                res.status(204).end();
            }
        });
    });

    app.get('/transactions/:blockNum/token_transfer', async (req, res) => {
        const blockNum = Number(req.params.blockNum);

        if (!Number.isInteger(blockNum)) {
            res.status(400).end();
            return;
        }

        const lastBlockCache = req.resolver.resolve<LastBlockCache>(LastBlockCache);
        const trxStarter = req.resolver.resolve(TransactionStarter);
        const TransactionRepository = req.resolver.resolve(TransactionRepository_);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            const data = await TransactionRepository.lookupTokenTransferByBlockNum(blockNum, trx);

            if (data.length === 0 && lastBlockCache.value !== null && lastBlockCache.value.block_num < blockNum) {
                // Return 404 when a block has not been processed yet.
                res.status(404).end();
                return;
            }

            // TODO: Can be cached (by intermediates) as it's immutable data, when we've seen the block.
            // We should set headers for intermediate caches to cache it.
            res.status(200).json(data);
        });
    });

    app.get('/transactions/:blockNum', async (req, res) => {
        const blockNum = Number(req.params.blockNum);

        if (!Number.isInteger(blockNum)) {
            res.status(400).end();
            return;
        }

        const lastBlockCache = req.resolver.resolve<LastBlockCache>(LastBlockCache);
        const trxStarter = req.resolver.resolve(TransactionStarter);
        const TransactionRepository = req.resolver.resolve(TransactionRepository_);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            const data = await TransactionRepository.lookupByBlockNum(blockNum, trx);

            if (data.length === 0 && lastBlockCache.value !== null && lastBlockCache.value.block_num < blockNum) {
                // Return 404 when a block has not been processed yet.
                res.status(404).end();
                return;
            }

            // TODO: Can be cached (by intermediates) as it's immutable data, when we've seen the block.
            // We should set headers for intermediate caches to cache it.
            res.status(200).json(data);
        });
    });

    app.get('/price_feed/:token', async (req, res) => {
        const token = req.params.token;
        // TODO: Timezone correction for blockchain time?
        const lastBlockCache = req.resolver.resolve<LastBlockCache>(LastBlockCache);
        const date = lastBlockCache.value?.block_time || new Date();
        const trxStarter = req.resolver.resolve<TransactionStarter>(TransactionStarter);
        const feed = req.resolver.resolve<PriceFeedConsumer>(PriceFeedConsumer);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            try {
                const price = await feed.getPriceAtPoint(token, date, trx);
                if (price !== undefined) {
                    res.status(200).json({ token, date, price });
                } else {
                    res.status(404).json({ token, date });
                }
            } catch (e: unknown) {
                if (e instanceof PriceFeedError) {
                    res.status(404).json({ token, date });
                } else {
                    // Should not happen, but oh well
                    throw e;
                }
            }
        });
    });

    // Get token balances for specific token
    app.get('/tokens/:token', async (req, res) => {
        const token = req.params.token;
        const trxStarter = req.resolver.resolve(TransactionStarter);
        const Balance = req.resolver.resolve(BalanceRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            res.json(await Balance.getTokenBalances([token], trx));
        });
    });

    // Get all token balances for specific token(s), via query param
    app.get('/tokens', async (req, res) => {
        const tokens = typeof req.query.token === 'string' ? [req.query.token] : isStringArray(req.query.token) ? req.query.token : undefined;
        if (tokens === undefined || tokens.length === 0) {
            res.status(400).end();
            return;
        }

        const trxStarter = req.resolver.resolve(TransactionStarter);
        const Balance = req.resolver.resolve(BalanceRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            res.json(await Balance.getTokenBalances(tokens, trx));
        });
    });

    app.get('/tokens/:token/supply', async (req, res) => {
        const token = req.params.token;
        const trxStarter = req.resolver.resolve<TransactionStarter>(TransactionStarter);
        const Balance = req.resolver.resolve(BalanceRepository);
        await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
            res.json(await Balance.getSupply(token, trx));
        });
    });
}
