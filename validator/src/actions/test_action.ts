import Action from './action';
import { ErrorType, ValidationError } from '../entities/errors';
import { EventLog, EventTypes } from '../entities/event_log';
import { test } from './schema';
import { OperationData } from '../entities/operation';
import { Trx } from '../db/tables';

export class TestAction extends Action<typeof test.actionSchema> {
    constructor(op: OperationData, data: unknown, index?: number) {
        super(test, op, data, index);
    }

    async validate(_trx?: Trx) {
        if (!this.params.type) throw new ValidationError('Invalid or missing type.', this, ErrorType.TestError);
        return true;
    }

    protected async process(_trx?: Trx): Promise<EventLog[]> {
        const event_log = new EventLog(EventTypes.UPDATE, { table: 'test' }, this.params.type);
        return [event_log];
    }
}
