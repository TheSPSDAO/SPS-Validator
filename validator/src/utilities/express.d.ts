import 'express';
import { Resolver } from './dependency-injection';

declare module 'express-serve-static-core' {
    interface Request {
        resolver: Resolver;
    }
}
