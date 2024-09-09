import Action from './action';
import { ErrorType, ValidationError } from '../entities/errors';
import { AnyObjectSchema } from 'yup';
import { OperationData } from '../entities/operation';
import { Schema } from './schema';
import { Trx } from '../db/tables';
import { AdminMembership } from '../libs/acl/admin';

// Base class for actions that can only be submitted by the game owner (Splinterlands)
export default abstract class AdminAction<T extends AnyObjectSchema> extends Action<T> {
    readonly #adminMembership: AdminMembership;
    protected constructor(adminMembership: AdminMembership, schema: Schema<T>, op: OperationData, data: unknown, index?: number) {
        super(schema, op, data, index);
        this.#adminMembership = adminMembership;
    }

    async validate(_trx?: Trx) {
        // Check that this.op.account is in the list of admin accounts in config
        const isAdmin = await this.#adminMembership.isAdmin(this.op.account);
        if (!isAdmin) {
            throw new ValidationError(`Only an administrator account may perform this action.`, this, ErrorType.AdminOnly);
        }

        return true;
    }
}
