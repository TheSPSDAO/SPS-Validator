import { ICustomDatabaseType } from '@wwwouter/typed-knex';

export class JSON implements ICustomDatabaseType {}
export class JSONB implements ICustomDatabaseType {}
/** internal id columns that shouldn't be exposed outside of the database */
export type SerialIntKey = ICustomDatabaseType & number;
export type SerialBigIntKey = ICustomDatabaseType & bigint;
export type SerialKeys = SerialIntKey | SerialBigIntKey;
