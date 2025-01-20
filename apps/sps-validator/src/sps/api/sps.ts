import { TransactionMode, TransactionStarter, Trx } from '@steem-monsters/splinterlands-validator';
import { Router } from 'express';
import { SpsBalanceRepository } from '../entities/tokens/balance';

const SUPPLY_CACHE_TIME_MS = 1000 * 60 * 5;

export function registerSpsRoutes(app: Router) {
    const supplyCache = new Map<string, { result: unknown; expires: Date }>();
    app.get('/tokens/:token/supply', async (req, res, next) => {
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
}
