declare module '@wwwouter/typed-knex' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ITypedQueryBuilder<Model, SelectableModel, Row> {
        getCount(): Promise<bigint | number>;
    }
}
