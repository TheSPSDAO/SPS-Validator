import type { Router } from 'express';
import { KnexToken } from '../db/tables';
import { Knex } from 'knex';

export function enableHealthChecker(app: Router) {
    app.get('/health-check/liveness', (_, res) => {
        res.status(200).send({ status: true });
    });
    app.get('/health-check/readiness', async (req, res) => {
        const knex = req.resolver.resolve<Knex>(KnexToken);
        let correct: boolean;
        try {
            await knex.raw('SELECT 1');
            correct = true;
        } catch (_) {
            correct = false;
        }

        const msg = {
            name: 'SPS Validator Node',
            status: correct,
            date: new Date(),
        };
        const code = correct ? 200 : 503;
        res.status(code).send(msg);
    });
}
