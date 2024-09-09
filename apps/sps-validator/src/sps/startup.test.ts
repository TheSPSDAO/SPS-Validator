import { StartupSync } from './sync';

jest.mock('node-fetch', () => {
    const actual = jest.requireActual('node-fetch');
    return {
        __esModule: true, // this property makes it work
        ...actual,
        default: jest.fn(),
    };
});
import fetch, { Response } from 'node-fetch';

import { container } from '../__tests__/test-composition-root';
import { DependencyContainer, inject, injectable } from 'tsyringe';
import { ConfigType } from './convict-config';
import { SpsConfigLoader } from './config';
import { EntryPoint } from '@steem-monsters/splinterlands-validator';
import { Fixture as BaseFixture } from '../__tests__/fixture';
const mock = fetch as jest.MockedFunction<typeof fetch>;

beforeAll(async () => {
    await fixture.init();
});

beforeEach(async () => {
    await fixture.restore();
    jest.resetAllMocks();
});

afterAll(async () => {
    await fixture.dispose();
});

@injectable()
class Fixture extends BaseFixture {
    readonly container: DependencyContainer;
    readonly syncPoint = 73;
    constructor(@inject(ConfigType) cfg: ConfigType) {
        super();
        const copy = { ...cfg, start_block: String(this.syncPoint), sm_api_url: 'http://api.invalid' };
        this.container = container.createChildContainer();
        this.container.register<ConfigType>(ConfigType, { useValue: copy });
    }
}

const fixture = container.resolve(Fixture);

@injectable()
class SubFixture {
    constructor(
        @inject(StartupSync) readonly startupSync: StartupSync,
        @inject(ConfigType) readonly cfg: ConfigType,
        @inject(SpsConfigLoader) readonly configLoader: SpsConfigLoader,
    ) {}
}

describe('Synchronise on block number', () => {
    const sub = fixture.container.resolve(SubFixture);
    test('Future should work without fetch', async () => {
        await expect(sub.startupSync.waitToProcessBlock(fixture.syncPoint + 1, sub.cfg, sub.configLoader.value)).resolves.toBeUndefined();
        expect(mock).not.toHaveBeenCalled();
    });

    test('Same start should work within once fetch', async () => {
        const response = { last_block: 72 };
        mock.mockResolvedValueOnce(new Response(JSON.stringify(response)));
        await expect(sub.startupSync.waitToProcessBlock(fixture.syncPoint, sub.cfg, sub.configLoader.value)).resolves.toBeUndefined();
        expect(mock).toHaveBeenCalledTimes(1);
    });

    test('Next block should work after a while', async () => {
        const response1 = { last_block: 71 };
        const response2 = { last_block: 72 };
        mock.mockResolvedValueOnce(new Response(JSON.stringify(response1))).mockResolvedValueOnce(new Response(JSON.stringify(response2)));
        await expect(sub.startupSync.waitToProcessBlock(fixture.syncPoint, sub.cfg, sub.configLoader.value)).resolves.toBeUndefined();
        expect(mock).toHaveBeenCalledTimes(2);
    });

    test('Unavailable server and then current block should work', async () => {
        const response2 = { last_block: 72 };
        mock.mockResolvedValueOnce(new Response(undefined, { status: 503 })).mockResolvedValueOnce(new Response(JSON.stringify(response2)));
        await expect(sub.startupSync.waitToProcessBlock(fixture.syncPoint, sub.cfg, sub.configLoader.value)).resolves.toBeUndefined();
        expect(mock).toHaveBeenCalledTimes(2);
    });
});

describe('Startup sanity test', () => {
    test.dbOnly('Can resolve EntryPoint', () => {
        const entrypoint = container.resolve(EntryPoint);
        expect(entrypoint).not.toBeUndefined();
    });

    test.dbOnly('Can preflight check an EntryPoint', async () => {
        const entrypoint = container.resolve(EntryPoint);
        const t = entrypoint.preflightCheck({ tablesToSkipValidation: ['non_fungible_tokens', 'non_fungible_token_locks'] });
        await expect(t).resolves.toBeUndefined();
    });
});
