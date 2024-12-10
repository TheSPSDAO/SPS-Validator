import { DependencyContainer, inject, injectable } from 'tsyringe';
import { Request, Response } from 'express-serve-static-core';
import express from 'express';
import { NextFunction } from 'express';
import helmet from 'helmet';
import {
    Middleware,
    Primer,
    SimpleMiddleware,
    Snapshot,
    TransactionStarter,
    UnmanagedSnapshot,
    TransactionMode,
    ApiOptions,
    Resolver,
    ConditionalApiActivator,
    registerApiRoutes,
} from '@steem-monsters/splinterlands-validator';
import { utils } from 'splinterlands-dhive-sl';
import { ManualDisposer } from '../manual-disposable';

//import { HiveClient, ValidatorEventSource, EventDistributorBuilder, PostgresHiveEventSourcesRepository, TokenCheck } from '@steem-monsters/atom';

// Each Middleware allows requests to read (cache) state from 'the world'. What this means is different for each type of middleware.

@injectable()
export class DefaultMiddleware extends SimpleMiddleware {}

/**
 * State is a fresh copy of the latest canonical cache(s).
 * Requests will not see concurrent updates, and any writes _to the caches_ are ignored w.r.t. to the block processor or other requests.
 * Note that writing _through_ a cache into the database, will most likely lead to inconsistent application state.
 */
@injectable()
export class SnapshotMiddleware implements Middleware {
    constructor(@inject(Snapshot) private readonly snapshot: Snapshot<DependencyContainer>) {}

    attachResolver(c: DependencyContainer) {
        return async (req: Request, res: Response, next: NextFunction) => {
            const container = c.createChildContainer();
            res.on('finish', () => container.dispose());
            this.snapshot.injectAll(container);
            container.resolve(ManualDisposer);
            req.resolver = container;
            next();
        };
    }
}

/**
 * State is a freshly primed copy of the singleton cache(s);
 * Requests will not see concurrent updates, and any writes _to the caches_ are ignored w.r.t. to the block processor or other requests.
 * Note that writing _through_ a cache into the database, will most likely lead to inconsistent application state.
 */
@injectable()
export class UnmanagedCacheMiddleware implements Middleware {
    constructor(
        @inject(TransactionStarter) private readonly transactionStarter: TransactionStarter,
        @inject(Primer) private readonly primer: Primer,
        @inject(UnmanagedSnapshot) private readonly snapshot: UnmanagedSnapshot<DependencyContainer>,
    ) {}

    attachResolver(c: DependencyContainer) {
        return async (req: Request, res: Response, next: NextFunction) => {
            // TODO: there is still a small window of time where database changes can happen, between this and any future transactions in the api call
            await this.transactionStarter.withTransaction(TransactionMode.Reporting, async (trx) => {
                // TODO: This only needs to be done once per block
                await this.primer.prime(trx);
            });
            const container = c.createChildContainer();
            res.on('finish', () => container.dispose());
            this.snapshot.injectAll(container);
            container.resolve(ManualDisposer);
            req.resolver = container;
            next();
        };
    }
}

@injectable()
export class EnabledApiActivator implements ConditionalApiActivator {
    constructor(
        @inject(ApiOptions) private readonly cfg: ApiOptions,
        @inject(Middleware) private readonly middleware: Middleware,
        @inject(Resolver) private readonly resolver: Resolver,
    ) {
        if (this.cfg.api_port === null) {
            throw new Error(`Attempting to enable API while it is supposed to be disabled`);
        }
    }

    perhapsEnableApi() {
        const app = express();

        //  secures API - see: https://www.securecoding.com/blog/using-helmetjs
        if (this.cfg.helmetjs) {
            app.use(helmet({ hidePoweredBy: true }));
        }

        app.use(function (req, res, next) {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, X-CSRF-Token, Content-Type, Accept, Authorization');
            res.header('X-Frame-Options', 'sameorigin');
            next();
        });

        app.listen(this.cfg.api_port, () => utils.log(`API running on port: ${this.cfg.api_port}`));
        app.set('trust proxy', true);
        registerApiRoutes(app, {
            health_checker: this.cfg.health_checker,
            resolver: this.resolver,
            injection_middleware: this.middleware,
        });
        return app;
    }
}
