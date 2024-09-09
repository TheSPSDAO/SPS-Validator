import { Request, Response } from 'express-serve-static-core';
import { NextFunction } from 'express';
import { Resolver } from '../utilities/dependency-injection';

export const Middleware: unique symbol = Symbol.for('Middleware');
export interface Middleware {
    attachResolver(c: Resolver): (req: Request, res: Response, next: NextFunction) => Promise<void>;
}

/**
 * State is the current singleton cache(s) and their contents.
 * Requests will see concurrent updates, and (in case of writes) share those between requests as well.
 */
export class SimpleMiddleware implements Middleware {
    attachResolver(c: Resolver) {
        return async (req: Request, res: Response, next: NextFunction) => {
            req.resolver = c;
            next();
        };
    }
}
