import { Router } from 'express';
import { BalanceRepository } from '../entities/tokens/balance';
import { ValidatorRepository } from '../entities/validator/validator';
import { ValidatorVoteRepository } from '../entities/validator/validator_vote';
import { enableHealthChecker } from './health';
import { TransactionRepository_ } from '../repositories/transactions';
import { Trx } from '../db/tables';
import { PriceFeedConsumer, PriceFeedError } from '../utilities/price_feed';
import { BlockRepository as BlockRepository_, LastBlockCache } from '../entities/block';
import { StakingRewardsRepository } from '../entities/tokens/staking_rewards';
import { Middleware } from './middleware';
import { TransactionMode, TransactionStarter } from '../db/transaction';
import { Resolver } from '../utilities/dependency-injection';
import { isStringArray } from '../utilities/guards';
import { PoolsHelper, ValidatorWatch } from '../config';
import { Shop } from '../libs/shop';

type ApiOptions = {
    health_checker: boolean;
    injection_middleware: Middleware;
    resolver: Resolver;
};

// @ts-expect-error
BigInt.prototype.toJSON = function () {
    return this.toString();
};

export function registerApiRoutes(app: Router, opts: ApiOptions): void {
    const { health_checker, injection_middleware, resolver } = opts;
    app.use(injection_middleware.attachResolver(resolver));
    if (health_checker) {
        enableHealthChecker(app);
    }

    app.get('/status', async (req, res, next) => {
        try {
            const lastBlockCache = req.resolver.resolve<LastBlockCache>(LastBlockCache);
            res.json({
                status: 'running',
                last_block: lastBlockCache.value?.block_num || 0,
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/shop/:saleName', async (req, res, next) => {
        try {
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
        } catch (err) {
            next(err);
        }
    });

    app.get('/balances', async (req, res, next) => {
        try {
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
        } catch (err) {
            next(err);
        }
    });

    app.get('/:token/balances', async (req, res, next) => {
        try {
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
        } catch (err) {
            next(err);
        }
    });

    app.get('/validators', async (req, res, next) => {
        try {
            const trxStarter = req.resolver.resolve(TransactionStarter);
            const Validator = req.resolver.resolve(ValidatorRepository);
            const skip = typeof req.query.skip === 'string' ? parseInt(req.query.skip, 10) : 0;
            const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;
            const active = typeof req.query.active === 'string' ? req.query.active.toLowerCase() === 'true' : undefined;
            const search = typeof req.query.search === 'string' ? req.query.search : undefined;
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                res.json(await Validator.getValidators({ count: true, skip, limit, is_active: active, search }, trx));
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/validator', async (req, res, next) => {
        try {
            const trxStarter = req.resolver.resolve(TransactionStarter);
            const Validator = req.resolver.resolve(ValidatorRepository);
            const account = typeof req.query.account === 'string' ? req.query.account : undefined;
            if (account === undefined) {
                res.status(400).end();
                return;
            }
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                res.json(await Validator.lookup(account, trx));
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/votes_by_account', async (req, res, next) => {
        try {
            const trxStarter = req.resolver.resolve(TransactionStarter);
            const ValidatorVote = req.resolver.resolve(ValidatorVoteRepository);
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                res.json(await ValidatorVote.lookupByVoter(req.query.account as string, trx));
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/votes_by_validator', async (req, res, next) => {
        try {
            const trxStarter = req.resolver.resolve(TransactionStarter);
            const ValidatorVote = req.resolver.resolve(ValidatorVoteRepository);
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                res.json(await ValidatorVote.lookupByValidator(req.query.validator as string, trx));
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/validator_config', async (req, res, next) => {
        try {
            const watcher = req.resolver.resolve<ValidatorWatch>(ValidatorWatch);
            if (!watcher.validator) {
                res.status(503).end();
                return;
            }
            res.json(watcher.validator);
        } catch (err) {
            next(err);
        }
    });

    app.get('/pool/:poolName', async (req, res, next) => {
        try {
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
                    res.status(503).end();
                }
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/pool/:poolName/reward_debt', async (req, res, next) => {
        try {
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
                if (debt !== undefined) {
                    res.status(200).json(debt);
                } else {
                    res.status(204).end();
                }
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/pool/:poolName/account_info', async (req, res, next) => {
        try {
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
                if (debt !== undefined) {
                    res.status(200).json(debt);
                } else {
                    res.status(204).end();
                }
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/transaction', async (req, res, next) => {
        try {
            const trxStarter = req.resolver.resolve(TransactionStarter);
            const TransactionRepository = req.resolver.resolve(TransactionRepository_);
            const id = typeof req.query.id === 'string' ? req.query.id : undefined;
            if (id === undefined) {
                res.status(400).end();
                return;
            }
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                const data = await TransactionRepository.lookupByTrxId(id, trx);
                if (data === null) {
                    res.status(404).end();
                    return;
                }
                res.status(200).json(data);
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/transactions/:blockNum/token_transfer', async (req, res, next) => {
        try {
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
                    res.status(404).end();
                    return;
                }

                res.status(200).json(data);
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/transactions/:blockNum', async (req, res, next) => {
        try {
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
                    res.status(404).end();
                    return;
                }

                res.status(200).json(data);
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/block/:blockNum', async (req, res, next) => {
        try {
            const blockNum = Number(req.params.blockNum);

            if (!Number.isInteger(blockNum)) {
                res.status(400).end();
                return;
            }

            const lastBlockCache = req.resolver.resolve<LastBlockCache>(LastBlockCache);
            const trxStarter = req.resolver.resolve(TransactionStarter);
            const BlockRepository = req.resolver.resolve(BlockRepository_);
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                const data = await BlockRepository.getByBlockNum(blockNum, trx);

                if (!data && lastBlockCache.value !== null && lastBlockCache.value.block_num < blockNum) {
                    res.status(404).end();
                    return;
                }

                res.status(200).json(data);
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/price_feed/:token', async (req, res, next) => {
        try {
            const token = req.params.token;
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
                        throw e;
                    }
                }
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/tokens/:token', async (req, res, next) => {
        try {
            const token = req.params.token;
            const trxStarter = req.resolver.resolve(TransactionStarter);
            const Balance = req.resolver.resolve(BalanceRepository);
            const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
            const skip = typeof req.query.skip === 'string' ? parseInt(req.query.skip, 10) : undefined;
            const systemAccounts = typeof req.query.systemAccounts === 'string' ? req.query.systemAccounts.toLowerCase() === 'true' : false;
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                res.json(
                    await Balance.getTokenBalances(
                        {
                            tokens: [token],
                            limit,
                            skip,
                            systemAccounts,
                            count: true,
                        },
                        trx,
                    ),
                );
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/tokens', async (req, res, next) => {
        try {
            const tokens = typeof req.query.token === 'string' ? [req.query.token] : isStringArray(req.query.token) ? req.query.token : undefined;
            if (tokens === undefined || tokens.length === 0) {
                res.status(400).end();
                return;
            }

            const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
            const skip = typeof req.query.skip === 'string' ? parseInt(req.query.skip, 10) : undefined;
            const systemAccounts = typeof req.query.systemAccounts === 'string' ? req.query.systemAccounts.toLowerCase() === 'true' : false;
            const trxStarter = req.resolver.resolve(TransactionStarter);
            const Balance = req.resolver.resolve(BalanceRepository);
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                res.json(
                    await Balance.getTokenBalances(
                        {
                            tokens,
                            limit,
                            skip,
                            systemAccounts,
                            count: true,
                        },
                        trx,
                    ),
                );
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/tokens/:token/supply', async (req, res, next) => {
        try {
            const token = req.params.token;
            const trxStarter = req.resolver.resolve<TransactionStarter>(TransactionStarter);
            const Balance = req.resolver.resolve(BalanceRepository);
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                res.json(await Balance.getSupply(token, trx));
            });
        } catch (err) {
            next(err);
        }
    });
}
