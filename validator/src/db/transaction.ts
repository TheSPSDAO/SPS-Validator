import { Knex } from 'knex';
import { Trx } from './tables';

export enum TransactionMode {
    Default, // The existing psql default, which is a read/write transaction in READ COMMITTED mode
    Reporting, // repeatable read read-only transaction of the world.
}

// Exported for pg-mem intercept
export const reporting_statement = 'set transaction isolation level repeatable read read only;';

export class TransactionStarter {
    public constructor(private readonly knex: Knex) {}

    private static modeToStatement(mode: TransactionMode): string | undefined {
        switch (mode) {
            case TransactionMode.Reporting:
                // This will error out if a write statement does take place withing the scope of the transaction,
                // while also offering some (modest) snapshot isolation performance improvements, mitigating some
                // negatives of using REPEATABLE READ (or even more strict) isolation levels in the first place.
                return reporting_statement;
            default:
                return;
        }
    }

    public async beginTransaction(mode = TransactionMode.Default): Promise<Trx> {
        const statement = TransactionStarter.modeToStatement(mode);
        if (statement) {
            const trx = (await this.knex.transaction()) as unknown as Trx;
            trx.mode = mode;
            trx.readOnly = mode === TransactionMode.Reporting;
            await trx.raw(statement);
            return trx;
        }
        return this.knex.transaction();
    }

    public async withTransaction<T>(config: TransactionMode, callback: (trx: Trx) => Promise<T>): Promise<T>;
    public async withTransaction<T>(callback: (trx: Trx) => Promise<T>): Promise<T>;
    public async withTransaction<T>(configOrCallback: TransactionMode | ((trx: Trx) => Promise<T>), callback?: (trx: Trx) => Promise<T>): Promise<T> {
        const actualCallback = callback ?? (configOrCallback as (trx: Trx) => Promise<T>);
        const actualConfig = callback ? (configOrCallback as TransactionMode) : undefined;
        const trx = await this.beginTransaction(actualConfig);
        try {
            const res = await actualCallback(trx);
            await trx.commit();
            return res;
        } catch (e) {
            await trx.rollback(e);
            throw e;
        }
    }
}
