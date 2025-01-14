import { getTableName } from '@wwwouter/typed-knex';
import { SerialKeys } from '../db/columns';

declare type constructor<T> = {
    new (...args: any[]): T;
};

type TableDescriptor = { table: string } | constructor<any>;

type ReturnNonSerialKeysOnly<T> = {
    [K in keyof T]: T[K] extends SerialKeys ? never : K;
}[keyof T];
type RemoveSerialKeys<T> = T extends string | number
    ? T
    : {
          [K in ReturnNonSerialKeysOnly<T>]: T[K];
      };

export class EventLog<D = any> {
    public readonly object_type: string;

    constructor(public readonly event_type: EventTypes, object_type: TableDescriptor, public readonly data: D) {
        if (typeof object_type === 'function') {
            this.object_type = getTableName(object_type);
        } else {
            this.object_type = object_type.table;
        }
    }
}

export enum EventTypes {
    UPDATE = 'update',
    UPSERT = 'upsert',
    INSERT = 'insert',
    DELETE = 'delete',
}
