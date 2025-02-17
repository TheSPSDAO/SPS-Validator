import { Result } from '@steem-monsters/lib-monad';
import { validate_block } from './schema';

describe('schema validation', () => {
    it.each`
        schema            | isValid  | params
        ${validate_block} | ${true}  | ${{ block_num: 12345, hash: 'abc123' }}
        ${validate_block} | ${true}  | ${{ block_num: 12345, hash: 'abc123' }}
        ${validate_block} | ${true}  | ${{ block_num: '12345', hash: 'abc123' }}
        ${validate_block} | ${false} | ${{ block_num: 12345, hash: 12345 }}
        ${validate_block} | ${false} | ${{ hash: 'abc123' }}
        ${validate_block} | ${false} | ${{ block_num: 12345 }}
    `(`verifies [$schema.action_name] schema requirements are [$isValid] for $params ($#) `, ({ schema, params, isValid }) => {
        const result = schema.validate(params);
        expect(Result.isOk(result)).toBe(isValid);
    });
});
