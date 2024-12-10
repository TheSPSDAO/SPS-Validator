import supertest from 'supertest';
import type { SuperTest, Test } from 'supertest';
import { container } from '../../__tests__/test-composition-root';
import express from 'express';
import { inject, injectable } from 'tsyringe';
import { Fixture as BaseFixture } from '../../__tests__/fixture';
import { ConfigType } from '../convict-config';
import { Middleware, registerApiRoutes, enableHealthChecker } from '@steem-monsters/splinterlands-validator';

@injectable()
class Fixture extends BaseFixture {
    readonly request: SuperTest<Test>;
    constructor(@inject(ConfigType) cfg: ConfigType, @inject(Middleware) middleware: Middleware) {
        super();
        const app = express();
        registerApiRoutes(app, {
            resolver: container,
            health_checker: cfg.health_checker,
            injection_middleware: middleware,
        });
        enableHealthChecker(app);
        this.request = supertest(app);
    }
}

const fixture = container.resolve(Fixture);

beforeAll(async () => {
    await fixture.init();
    await fixture.restore();
});

test('Health point sanity test.', async () => {
    const livePre = await fixture.request.get('/health-check/liveness');
    expect(livePre.status).toBe(200);
    expect(livePre.body.status).toBe(true);

    const readyPre = await fixture.request.get('/health-check/readiness');
    expect(readyPre.status).toBe(200);
    expect(readyPre.body.status).toBe(true);

    await fixture.dispose();

    const livePost = await fixture.request.get('/health-check/liveness');
    expect(livePost.status).toBe(200);
    expect(livePost.body.status).toBe(true);

    const readyPost = await fixture.request.get('/health-check/readiness');
    expect(readyPost.status).toBe(503);
    expect(readyPost.body.status).toBe(false);
});
