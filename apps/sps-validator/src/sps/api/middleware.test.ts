import * as supertest from 'supertest';
import * as express from 'express';
import type { Express } from 'express';
import { DependencyContainer, InjectionToken } from 'tsyringe';
import { SpsConfigLoader } from '../config';
import { container } from '../../__tests__/test-composition-root';
import { Fixture } from '../../__tests__/fixture';
import { DefaultMiddleware, SnapshotMiddleware, UnmanagedCacheMiddleware } from './index';
import { Middleware, Snapshot, ConfigEntity } from '@steem-monsters/splinterlands-validator';

const fixture = container.resolve(Fixture);

function freshContainer() {
    return container.createChildContainer();
}

function freshApp(c: DependencyContainer, token: InjectionToken<Middleware>) {
    const app = express();
    const middleware = c.resolve<Middleware>(token);
    app.use(middleware.attachResolver(c));
    return app;
}

let c: DependencyContainer;

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    c = freshContainer();
    await fixture.handle.query(ConfigEntity).insertItem({
        group_name: '$root',
        group_type: 'object',
        name: 'nonce',
        index: 0,
        value_type: 'string',
        value: 'untouched',
    });
    const loader = c.resolve<SpsConfigLoader>(SpsConfigLoader);
    await loader.load();
});

afterAll(async () => {
    await fixture.dispose();
});

describe('World state', () => {
    function registerTestRoute(app: Express) {
        app.get('/test', (req, res) => {
            const state = req.resolver.resolve<SpsConfigLoader>(SpsConfigLoader);
            res.json(state.value);
        });
    }

    test.dbOnly('DefaultMiddleware gets updated', async () => {
        const app = freshApp(c, DefaultMiddleware);
        registerTestRoute(app);
        const request = supertest(app);

        const before = await request.get('/test');
        expect(before.body.nonce).toBe('untouched');

        const loader = c.resolve<SpsConfigLoader>(SpsConfigLoader);
        loader.update({ group_name: '$root', name: 'nonce', value: '7' });
        const after = await request.get('/test');
        expect(after.body.nonce).toBe('7');
    });
    test.dbOnly('SnapshotMiddleware - without commit uses old value', async () => {
        const app = freshApp(c, SnapshotMiddleware);
        registerTestRoute(app);
        const request = supertest(app);

        const before = await request.get('/test');
        expect(before.body.nonce).toBe('untouched');

        const loader = c.resolve<SpsConfigLoader>(SpsConfigLoader);
        loader.update({ group_name: '$root', name: 'nonce', value: '8' });
        const after = await request.get('/test');
        expect(after.body.nonce).toBe('untouched');
    });
    test.dbOnly('SnapshotMiddleware - with commit gets updated', async () => {
        const app = freshApp(c, SnapshotMiddleware);
        registerTestRoute(app);
        const request = supertest(app);

        const before = await request.get('/test');
        expect(before.body.nonce).toBe('untouched');

        const snapshot = c.resolve<Snapshot<DependencyContainer>>(Snapshot);
        const loader = c.resolve<SpsConfigLoader>(SpsConfigLoader);
        loader.update({ group_name: '$root', name: 'nonce', value: '9' });
        snapshot.commit();
        const after = await request.get('/test');
        expect(after.body.nonce).toBe('9');
    });
    test.dbOnly('UnmanagedCacheMiddleware - without db updates uses old value', async () => {
        const app = freshApp(c, UnmanagedCacheMiddleware);
        registerTestRoute(app);
        const request = supertest(app);

        const before = await request.get('/test');
        expect(before.body.nonce).toBe('untouched');

        const loader = c.resolve<SpsConfigLoader>(SpsConfigLoader);
        loader.update({ group_name: '$root', name: 'nonce', value: '10' });
        const after = await request.get('/test');
        expect(after.body.nonce).toBe('untouched');
    });
    test.dbOnly('UnmanagedCacheMiddleware - with db update gets updated', async () => {
        const app = freshApp(c, UnmanagedCacheMiddleware);
        registerTestRoute(app);
        const request = supertest(app);

        const before = await request.get('/test');
        expect(before.body.nonce).toBe('untouched');

        const loader = c.resolve<SpsConfigLoader>(SpsConfigLoader);
        await loader.updateConfig('$root', 'nonce', '11');
        const after = await request.get('/test');
        expect(after.body.nonce).toBe('11');
    });
});

describe('Concurrent modification should not interfere', () => {
    let sideEffect: () => Promise<void> | undefined;
    function registerTestRoute(app: Express) {
        app.get('/test', async (req, res) => {
            const loader = req.resolver.resolve<SpsConfigLoader>(SpsConfigLoader);
            const before = loader.value;
            if (sideEffect) await sideEffect();
            const after = loader.value;
            res.json({ before, after });
        });
    }

    test.dbOnly('SnapshotMiddleware', async () => {
        const app = freshApp(c, SnapshotMiddleware);
        registerTestRoute(app);
        const request = supertest(app);

        const snapshot = c.resolve<Snapshot<DependencyContainer>>(Snapshot);
        const loader = c.resolve<SpsConfigLoader>(SpsConfigLoader);
        sideEffect = async () => {
            loader.update({ group_name: '$root', name: 'nonce', value: '42' });
            snapshot.commit();
        };
        const {
            body: { before, after },
        } = await request.get('/test');
        const world = loader.value;
        expect(world.nonce).toBe('42');
        expect(before.nonce).toBe('untouched');
        expect(after.nonce).toBe('untouched');
    });

    test.dbOnly('UnmanagedCacheMiddleware', async () => {
        const app = freshApp(c, UnmanagedCacheMiddleware);
        registerTestRoute(app);
        const request = supertest(app);

        const loader = c.resolve<SpsConfigLoader>(SpsConfigLoader);
        sideEffect = async () => {
            await loader.updateConfig('$root', 'nonce', '72');
        };

        const {
            body: { before, after },
        } = await request.get('/test');
        const world = loader.value;

        expect(world.nonce).toBe('72');
        expect(before.nonce).toBe('untouched');
        expect(after.nonce).toBe('untouched');
    });
});

describe('Interleaved requests should not interfere.', () => {
    let sideEffect: () => Promise<string | undefined> | undefined;
    function registerTestRoutes(app: Express) {
        app.get('/test/', async (req, res) => {
            const loader = req.resolver.resolve<SpsConfigLoader>(SpsConfigLoader);
            const before = loader.value;
            let effectResult: string | undefined;
            if (sideEffect) effectResult = await sideEffect();
            const after = loader.value;
            res.json({ before, after, effectResult });
        });

        app.get('/test/embedded', async (req, res) => {
            const loader = req.resolver.resolve<SpsConfigLoader>(SpsConfigLoader);
            res.json(loader.value);
        });
    }

    test.dbOnly('SnapshotMiddleware', async () => {
        const app = freshApp(c, SnapshotMiddleware);
        registerTestRoutes(app);
        const request = supertest(app);

        const snapshot = c.resolve<Snapshot<DependencyContainer>>(Snapshot);
        const loader = c.resolve<SpsConfigLoader>(SpsConfigLoader);
        sideEffect = async () => {
            loader.update({ group_name: '$root', name: 'nonce', value: '99' });
            snapshot.commit();
            const { body: response } = await request.get('/test/embedded');
            return response.nonce;
        };

        const {
            body: { before, after, effectResult },
        } = await request.get('/test');
        const world = loader.value;

        expect(world.nonce).toBe('99');
        expect(effectResult).toBe('99');
        expect(before.nonce).toBe('untouched');
        expect(after.nonce).toBe('untouched');
    });

    test.dbOnly('UnmanagedCacheMiddleware', async () => {
        const app = freshApp(c, UnmanagedCacheMiddleware);
        registerTestRoutes(app);
        const request = supertest(app);

        const loader = c.resolve<SpsConfigLoader>(SpsConfigLoader);
        sideEffect = async () => {
            await loader.updateConfig('$root', 'nonce', '44');
            const { body: response } = await request.get('/test/embedded');
            return response.nonce;
        };

        const {
            body: { before, after, effectResult },
        } = await request.get('/test');
        const world = loader.value;

        expect(world.nonce).toBe('44');
        expect(effectResult).toBe('44');
        expect(before.nonce).toBe('untouched');
        expect(after.nonce).toBe('untouched');
    });
});
