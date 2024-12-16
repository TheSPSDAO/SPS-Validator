import { object, string, number, boolean, array, AnyObjectSchema, Asserts } from 'yup';
import { isHiveAccount, isSystemAccount } from '../utilities/accounts';
import { Result } from '@steem-monsters/lib-monad';
export type { AnyObjectSchema, InferType } from 'yup';

function isEmptyOrValidSystemAccount(value: string | undefined): boolean {
    // Schema will specify if value is required
    if (!value) {
        return true;
    } else {
        return isSystemAccount(value);
    }
}

function isEmptyOrValidAccountOrValidSystemAccount(value: string | undefined): boolean {
    // Schema will specify if value is required
    if (!value) {
        return true;
    }

    // Validate System Account
    if (isEmptyOrValidSystemAccount(value)) {
        return true;
    }

    // Validate Hive Account
    return isHiveAccount(value);
}

function isEmptyOrValidAccount(value: string | undefined): boolean {
    // Schema will specify if value is required
    if (!value) {
        return true;
    }

    return isHiveAccount(value);
}

/**
 * Schema that checks if the specified string is a valid system or hive account.
 */
export const hiveUsernameOrSystemAccount = string()
    .test('account_validation', 'The following input is not a system or hive account.', (v) => isEmptyOrValidAccountOrValidSystemAccount(v))
    .strict();
export const token = string().strict().required();

// TODO: Arbitrarily chosen, but it should fit in a NUMERIC(14, 3)
const maxQty = 99_999_999_999.999;
const qty = number().required().max(maxQty);

/**
 * Schema that checks if the specified string is a valid system account.
 */
export const systemAccount = string().test('system_account_validation', 'The following input is not a system account.', isEmptyOrValidSystemAccount).strict();
/**
 * Schema that checks if the specified string is a valid Hive account.
 */
export const hiveAccount = string().test('hive_account_validation', 'The following input is not a valid hive account.', isEmptyOrValidAccount).strict();

export class Schema<T extends AnyObjectSchema> {
    public readonly actionSchema: T;
    private readonly wrappedSchema;

    constructor(public readonly action_name: string, actionSchema: T) {
        //TODO: currently accepting unknown fields?
        this.actionSchema = actionSchema.unknown(true);
        this.wrappedSchema = object({
            action: string().required(),
            params: this.actionSchema,
        });
    }

    // get property to enforce type predicate is propagated cleanly
    get validate(): (value: unknown) => Result<Asserts<T>, Error> {
        return (value: unknown) => {
            try {
                const v = this.actionSchema.validateSync(value);
                return Result.Ok(v);
            } catch (e: unknown) {
                if (e instanceof Error) {
                    return Result.Err(e);
                }
                return Result.Err(new Error('Unknown error'));
            }
        };
    }

    // get property to enforce type predicate is propagated cleanly
    get validateWrapped(): (value: unknown) => Result<{ action: string; params: Asserts<T> }, Error> {
        return (value: unknown) => {
            try {
                const v = this.wrappedSchema.validateSync(value);
                return Result.Ok(v);
            } catch (e: unknown) {
                if (e instanceof Error) {
                    return Result.Err(e);
                }
                return Result.Err(new Error('Unknown error'));
            }
        };
    }
}

const test = new Schema(
    'test',
    object({
        type: string().required(),
        quantity: number().integer().min(0).max(100),
        extra: number().min(0),
        data: object({
            a: string().required(),
            b: number().integer().min(0).max(100).required(),
        }).default(undefined),
        values: array().of(number().integer().min(0).max(0)),
        items: array().of(
            object({
                a: string().required(),
                b: number().integer().min(0).max(0).required(),
            }),
        ),
        okay: boolean(),
    }),
);

export { test, maxQty, qty };
