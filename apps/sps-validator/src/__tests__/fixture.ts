import { autoInjectable, inject, injectAll } from 'tsyringe';
import { Handle, KnexToken } from '@steem-monsters/splinterlands-validator';
import { Knex } from 'knex';
import { Disposable } from './disposable';
import { Backup } from './fake-db';
import { TestHelper } from './db-helpers';
import { OpsHelper } from './process-op';

@autoInjectable()
export class Fixture implements Disposable, Backup {
    private readonly disposables: Disposable[];
    private readonly backup: Backup;
    readonly knex: Knex;
    readonly handle: Handle;
    readonly testHelper: TestHelper;
    readonly opsHelper: OpsHelper;
    constructor(
        @injectAll(Disposable) disposables?: Disposable[],
        @inject(Backup) backup?: Backup,
        @inject(KnexToken) knex?: Knex,
        @inject(Handle) handle?: Handle,
        @inject(TestHelper) testHelper?: TestHelper,
        @inject(OpsHelper) opsHelper?: OpsHelper,
    ) {
        this.disposables = disposables!;
        this.backup = backup!;
        this.knex = knex!;
        this.handle = handle!;
        this.testHelper = testHelper!;
        this.opsHelper = opsHelper!;
    }

    async init() {
        await this.backup.init();
    }

    async dispose(): Promise<void> {
        for (const disposable of this.disposables) {
            await disposable.dispose();
        }
    }

    async restore() {
        await this.backup.restore();
    }
}
