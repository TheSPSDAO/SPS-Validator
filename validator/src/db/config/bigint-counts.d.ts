import * as _typedKnex from '@wwwouter/typed-knex';

declare module '@wwwouter/typed-knex' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ITypedQueryBuilder<Model, SelectableModel, Row> {
        // Actual node-pg returns strings that should be bigint; pg-mem just returns a number.
        getCount(): Promise<bigint | number>;
    }
}
