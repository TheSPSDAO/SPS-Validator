import { TransactionMode, TransactionStarter, Trx } from '@steem-monsters/splinterlands-validator';
import { Router } from 'express';
import { SpsBalanceRepository } from '../entities/tokens/balance';

const SUPPLY_CACHE_TIME_MS = 1000 * 60 * 5;

export function registerSpsRoutes(app: Router) {
    const supplyCache = new Map<string, { result: unknown; expires: Date }>();
    app.get('/extensions/tokens/:token/supply', async (req, res, next) => {
        try {
            const token = req.params.token;
            const trxStarter = req.resolver.resolve<TransactionStarter>(TransactionStarter);
            const Balance = req.resolver.resolve(SpsBalanceRepository);
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                const cached = supplyCache.get(token);
                if (cached && cached.expires > new Date()) {
                    return res.json(cached.result);
                }
                const result = await Balance.getSupply(token, trx);
                supplyCache.set(token, { result, expires: new Date(Date.now() + SUPPLY_CACHE_TIME_MS) });
                return res.json(result);
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/extensions/tokens/balances', async (req, res, next) => {
        try {
            const account = typeof req.query.account === 'string' ? req.query.account : undefined;
            if (account === undefined) {
                res.status(400).end();
                return;
            }

            const trxStarter = req.resolver.resolve(TransactionStarter);
            const Balance = req.resolver.resolve(SpsBalanceRepository);
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                res.json(await Balance.getExtendedBalances(account, trx));
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/extensions/tokens/:token/balances', async (req, res, next) => {
        try {
            const MAX = 100;
            const accounts = typeof req.query.accounts === 'string' ? req.query.accounts.split(',').slice(0, MAX) : [];
            const token = typeof req.params.token === 'string' ? req.params.token.toUpperCase() : undefined;
            if (accounts.length <= 0 || !token) {
                res.status(400).end();
                return;
            }

            const trxStarter = req.resolver.resolve(TransactionStarter);
            const Balance = req.resolver.resolve(SpsBalanceRepository);
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                res.json(await Balance.getMultipleExtendedBalancesByToken(token, accounts, trx));
            });
        } catch (err) {
            next(err);
        }
    });

    app.get('/extensions/tokens/:token', async (req, res, next) => {
        try {
            const token = req.params.token;
            const trxStarter = req.resolver.resolve(TransactionStarter);
            const Balance = req.resolver.resolve(SpsBalanceRepository);
            const limit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : undefined;
            const skip = typeof req.query.skip === 'string' ? parseInt(req.query.skip, 10) : undefined;
            const systemAccounts = typeof req.query.systemAccounts === 'string' ? req.query.systemAccounts.toLowerCase() === 'true' : false;
            await trxStarter.withTransaction(TransactionMode.Reporting, async (trx?: Trx) => {
                res.json(
                    await Balance.getTokenExtendedBalances(
                        {
                            token,
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
}
