import { TypedKnex } from '@wwwouter/typed-knex';
import knex, { Knex } from 'knex';
import { singleton } from 'tsyringe';
import { Handle, log, LogLevel } from '@steem-monsters/splinterlands-validator';
import { Disposable } from './disposable';
import crypto from 'crypto';

export interface Backup {
    init(): Promise<void>;
    restore(): Promise<void>;
    dispose(): Promise<void>;
}
export const Backup: unique symbol = Symbol.for('Backup');

export type TestWrapper = {
    test: jest.It;
};
export const TestWrapper: unique symbol = Symbol.for('TestWrapper');

const TEMPLATE_DB_NAME = process.env.SPL_TEST_DB_TEMPLATE!;
const TEMPLATE_DB_CONNECTION_STRING = process.env.SPL_TEST_DB_TEMPLATE_CONNECTION_STRING!;

@singleton()
export class FreshDatabase implements Disposable {
    public readonly knex: Knex;
    public readonly handle: Handle;
    public readonly test: jest.It;

    private currentDb?: string;
    private currentKnex: Knex | undefined;
    private currentHandle: Handle | undefined;

    private readonly knexProxy = {
        get: (_: any, prop: string) => {
            if (this.currentKnex === undefined) {
                throw new Error('Knex not initialized');
            }
            return (this.currentKnex as any)[prop];
        },
    };

    private readonly handleProxy = {
        get: (_: any, prop: string) => {
            if (this.currentHandle === undefined) {
                throw new Error('Knex not initialized');
            }
            return (this.currentHandle as any)[prop];
        },
    };

    public constructor() {
        try {
            // no idea what this is doing??
            this.test = it;
        } catch (_) {
            this.test = it.skip;
            // TODO: typings are a lie: support It chaining
            // no idea what this is doing??
            this.test.todo = it.todo;
            this.test.skip = it.skip;
            log(`Could not locate "structure.sql" file; run \`npm run dump-structure\` to run tests with a fake database.`, LogLevel.Error);
        }
        // we have to use proxies for the knex/handle fields that the rest of the tests use
        // because they need to be non-null during setup and we can't initialize them until
        // the test starts
        this.knex = new Proxy({}, this.knexProxy) as Knex;
        this.handle = new Proxy({}, this.handleProxy) as Handle;
    }

    public async init() {
        if (TEMPLATE_DB_CONNECTION_STRING === undefined) {
            throw new Error('Template DB connection string not found in TEMPLATE_DB_CONNECTION_STRING env var.');
        } else if (TEMPLATE_DB_NAME === undefined) {
            throw new Error('Template DB name not found in TEMPLATE_DB_NAME env var.');
        }
    }

    public async restore() {
        const knexInstance = knex({
            client: 'pg',
            connection: {
                // this can be cleaned up a bunch, but its working for now and test dont take 8 minutes :)
                connectionString: TEMPLATE_DB_CONNECTION_STRING.replace(TEMPLATE_DB_NAME, 'control_db'),
            },
            searchPath: 'public',
        });
        if (this.currentDb) {
            await this.currentKnex?.destroy();
            await knexInstance.raw(`DROP DATABASE IF EXISTS ${this.currentDb};`);
        }
        this.currentDb = `sps_validator_test_${crypto.randomBytes(16).toString('hex')}`;
        await knexInstance.raw(`CREATE DATABASE ${this.currentDb} TEMPLATE ${TEMPLATE_DB_NAME};`);
        await knexInstance.destroy();

        this.currentKnex = knex({
            client: 'pg',
            connection: {
                connectionString: TEMPLATE_DB_CONNECTION_STRING.replace(TEMPLATE_DB_NAME, this.currentDb!),
            },
            searchPath: 'public',
        });
        const handle = new TypedKnex(this.currentKnex) as Handle;
        handle.knexInstance = this.currentKnex;
        this.currentHandle = handle;
    }

    public async dispose(): Promise<void> {
        if (this.currentKnex === undefined || this.currentHandle === undefined) {
            return;
        }
        await this.currentKnex.destroy();

        // drop the database that was created
        if (this.currentDb) {
            await this.currentKnex?.destroy();
            const knexInstance = knex({
                client: 'pg',
                connection: {
                    // this can be cleaned up a bunch, but its working for now and test dont take 8 minutes :)
                    connectionString: TEMPLATE_DB_CONNECTION_STRING.replace(TEMPLATE_DB_NAME, 'control_db'),
                },
                searchPath: 'public',
            });
            await knexInstance.raw(`DROP DATABASE IF EXISTS ${this.currentDb};`);
            await knexInstance.destroy();
        }
    }
}
