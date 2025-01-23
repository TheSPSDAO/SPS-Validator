import 'express';
import { Resolver } from '@steem-monsters/splinterlands-validator';

declare module 'express-serve-static-core' {
    interface Request {
        resolver: Resolver;
    }
}
