import { hiveUsernameOrSystemAccount, test as test_schema, systemAccount, hiveAccount } from './schema';
import { Result } from '@steem-monsters/lib-monad';

describe('schema validation', () => {
    it.each`
        schema         | isValid | params
        ${test_schema} | ${true} | ${{ type: 'hello' }}
        ${test_schema} | ${true} | ${{ type: 'hello', quantity: 50 }}
        ${test_schema} | ${true} | ${{ type: 'hello', quantity: '50' }}
        ${test_schema} | ${true} | ${{ type: 'hello', extra: 50 }}
        ${test_schema} | ${true} | ${{ type: 'hello', extra: '50' }}
        ${test_schema} | ${true} | ${{ type: 'hello', data: { a: 'hello again', b: 50 } }}
        ${test_schema} | ${true} | ${{ type: 'hello', data: { a: 'hello again', b: '50' } }}
        ${test_schema} | ${true} | ${{ type: 'hello', values: [0] }}
        ${test_schema} | ${true} | ${{ type: 'hello', values: ['0'] }}
        ${test_schema} | ${true} | ${{ type: 'hello', items: [{ a: 'hello yet again', b: 0 }] }}
        ${test_schema} | ${true} | ${{ type: 'hello', items: [{ a: 'hello yet again', b: '0' }] }}
        ${test_schema} | ${true} | ${{ type: 'hello', okay: true }}
        ${test_schema} | ${true} | ${{ type: 'hello', okay: 'true' }}
    `(`verifies [$schema.action_name] schema requirements are [$isValid] for $params ($#) `, ({ schema, params, isValid }) => {
        const result = schema.validate(params);
        expect(Result.isOk(result)).toBe(isValid);
    });
});

describe('custom yup schema validation', () => {
    // Some test cases from https://support.splinterlands.com/hc/en-us/articles/5064371263764-HIVE-Splinterlands-Account-Naming-Rules
    it.each`
        schema                                    | isValid  | params
        ${hiveUsernameOrSystemAccount}            | ${false} | ${'HaLlO'}
        ${hiveUsernameOrSystemAccount}            | ${true}  | ${'hallo'}
        ${hiveUsernameOrSystemAccount.optional()} | ${true}  | ${''}
        ${hiveUsernameOrSystemAccount.optional()} | ${true}  | ${'hallo'}
        ${hiveUsernameOrSystemAccount.optional()} | ${true}  | ${undefined}
        ${hiveUsernameOrSystemAccount.required()} | ${false} | ${undefined}
        ${hiveUsernameOrSystemAccount.required()} | ${false} | ${''}
        ${hiveUsernameOrSystemAccount.required()} | ${true}  | ${'hallo'}
        ${systemAccount}                          | ${true}  | ${'$HELLO'}
        ${systemAccount.optional()}               | ${true}  | ${'$HELLO'}
        ${systemAccount.optional()}               | ${true}  | ${''}
        ${systemAccount.optional()}               | ${true}  | ${undefined}
        ${systemAccount.required()}               | ${true}  | ${'$HELLO'}
        ${systemAccount.required()}               | ${false} | ${''}
        ${systemAccount.required()}               | ${false} | ${undefined}
        ${hiveAccount}                            | ${true}  | ${'abc'}
        ${hiveAccount.optional()}                 | ${true}  | ${'abc'}
        ${hiveAccount.optional()}                 | ${true}  | ${''}
        ${hiveAccount.optional()}                 | ${true}  | ${undefined}
        ${hiveAccount.required()}                 | ${true}  | ${'abc'}
        ${hiveAccount.required()}                 | ${false} | ${''}
        ${hiveAccount.required()}                 | ${false} | ${undefined}
        ${hiveAccount.required()}                 | ${false} | ${'a'}
        ${hiveAccount.required()}                 | ${false} | ${'ab'}
        ${hiveAccount.required()}                 | ${true}  | ${'abcdefghijklmnop'}
        ${hiveAccount.required()}                 | ${false} | ${'abcdefghijklmnopq'}
        ${hiveAccount.required()}                 | ${false} | ${'abc-'}
        ${hiveAccount.required()}                 | ${true}  | ${'ab-c'}
        ${hiveAccount.required()}                 | ${false} | ${'abc.'}
        ${hiveAccount.required()}                 | ${true}  | ${'rofl.lol'}
        ${hiveAccount.required()}                 | ${false} | ${'app.js'}
        ${hiveAccount.required()}                 | ${false} | ${'a.b.c.37'}
        ${hiveAccount.required()}                 | ${false} | ${'a37..b37'}
        ${hiveAccount.required()}                 | ${false} | ${'a37--b37'}
        ${hiveAccount.required()}                 | ${false} | ${'a37.-b37'}
        ${hiveAccount.required()}                 | ${false} | ${'a37b37-'}
        ${hiveAccount.required()}                 | ${true}  | ${'a37-b37'}
        ${hiveAccount.required()}                 | ${false} | ${'K37'}
        ${hiveAccount.required()}                 | ${false} | ${'37K'}
        ${hiveAccount.required()}                 | ${false} | ${'37k'}
        ${hiveAccount.required()}                 | ${false} | ${'373'}
        ${hiveAccount.required()}                 | ${true}  | ${'a37'}
    `(`verifies schema requirements are [$isValid] for $params ($#) `, ({ schema, params, isValid }) => {
        expect(schema.isValidSync(params)).toBe(isValid);
    });
});
