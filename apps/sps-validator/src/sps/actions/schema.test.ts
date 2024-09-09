import { legacy_price_feed } from './validator/price_feed';
import { Result } from '@steem-monsters/lib-monad';

describe('schema validation', () => {
    it.each`
        schema               | isValid  | params
        ${legacy_price_feed} | ${true}  | ${{ sps_price: '0.0001', dec_price: 0.0001 }}
        ${legacy_price_feed} | ${true}  | ${{ sps_price: 0.0001, dec_price: '0.0001' }}
        ${legacy_price_feed} | ${false} | ${{ sps_price: 3.0, dec_price: -2 }}
        ${legacy_price_feed} | ${true}  | ${{ sps_price: '0.0001', dec_price: 0.00001 }}
        ${legacy_price_feed} | ${true}  | ${{ sps_price: '0.00001', dec_price: 0.00001 }}
        ${legacy_price_feed} | ${false} | ${{ sps_price: '0.0001' }}
        ${legacy_price_feed} | ${false} | ${{ dec_price: 0.0001 }}
    `(`verifies [$schema.action_name] schema requirements are [$isValid] for $params ($#) `, ({ schema, params, isValid }) => {
        const result = schema.validate(params);
        expect(Result.isOk(result)).toBe(isValid);
    });
});
