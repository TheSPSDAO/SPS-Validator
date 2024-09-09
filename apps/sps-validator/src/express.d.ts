import 'express';

declare module 'express-serve-static-core' {
    interface Request {
        resolver: Resolver;
    }
}
