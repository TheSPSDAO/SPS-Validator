import { OperationData } from '../entities/operation';
import * as utils from '../utils';
import { Schema } from './schema';
import { LogObj, ValidationError } from '../entities/errors';
import { EventLog } from '../entities/event_log';
import { AnyObjectSchema, Asserts } from 'yup';
import { Trx } from '../db/tables';
import { Result } from '@steem-monsters/lib-monad';

class ActionConstructionError extends Error {}

export interface IAction {
    readonly id: string;
    readonly op: OperationData;
    readonly unique_trx_id: string;
    readonly params: Record<string, unknown>;
    readonly players: string[];
    readonly success?: boolean;
    readonly error?: LogObj;
    readonly result?: EventLog[];

    isSupported(): boolean;

    isEmpty(): boolean;

    execute(trx?: Trx): Promise<IAction>;
}

export default abstract class Action<T extends AnyObjectSchema> implements IAction {
    protected readonly action_name: string;
    public readonly id: string;
    public readonly params: Asserts<T>;
    public readonly players: string[];
    public success: boolean | undefined = undefined;
    public result: EventLog[] | undefined = undefined;
    public error: LogObj | undefined = undefined;

    // TODO: Circular Dependency on Operation?
    protected constructor(schema: Schema<T>, public readonly op: OperationData, data: unknown, public readonly index = 0) {
        this.action_name = schema.action_name;
        const result = schema.validateWrapped(data);
        if (Result.isOk(result)) {
            this.id = result.value.action;
            this.params = result.value.params;

            this.players = [this.op.account];

            // TODO: Handle proxy account transactions
        } else {
            utils.log(`Action ${this.action_name} failed to execute due to schema validation mismatch`, utils.LogLevel.Info);
            utils.log(`Invalidated payload: ${JSON.stringify(data)}, ${result.error}`, utils.LogLevel.Debug);
            throw new ActionConstructionError(`Data could not be validated for action ${this.action_name}.`);
        }
    }

    async execute(trx?: Trx) {
        try {
            utils.log(
                `Processing action [${this.unique_trx_id}] of type [${this.action_name}] from [@${this.op.account}] with data [${JSON.stringify(this.params)}]`,
                utils.LogLevel.Info,
            );
            await this.validate(trx);
            this.result = await this.process(trx);
            if (this.players.length > 1) {
                // dedupe players in case the action added the same player multiple times for some reason.
                // this simplifies logic in actions that support delegation
                this.players.splice(0, this.players.length, ...new Set(this.players));
            }
            this.success = true;
        } catch (err: unknown) {
            this.success = false;
            if (err instanceof ValidationError) {
                this.error = err.log_obj;
                utils.log(`ValidationError while processing [${this.unique_trx_id}]: ${JSON.stringify(this.error)}`, utils.LogLevel.Info);
            } else if (err instanceof Error) {
                utils.log(`Error while processing [${this.unique_trx_id}]: ${JSON.stringify(err.message)}\r\n${err.stack}`, utils.LogLevel.Error, 'Red');
                throw err;
            } else {
                utils.log(`Unknown error while processing [${this.unique_trx_id}]: ${JSON.stringify(err)}`, utils.LogLevel.Error, 'Red');
                throw err;
            }
        }

        return this;
    }

    /**
     * Checks if the parameters passed are valid against the schema for the this action name.
     * Returns true when okay, throws on validation error.
     * TODO: remove the return value - it's never checked because we're supposed to throw, so its confusing.
     * @param client
     */
    protected abstract validate(trx?: Trx): Promise<boolean>;

    isSupported(): boolean {
        return true;
    }

    isEmpty(): boolean {
        return this.success === undefined || (this.result === undefined && this.error === undefined);
    }

    protected abstract process(trx?: Trx): Promise<EventLog[]>;

    get unique_trx_id(): string {
        return this.index > 0 ? `${this.op.trx_op_id}.${this.index}` : this.op.trx_op_id;
    }
}
