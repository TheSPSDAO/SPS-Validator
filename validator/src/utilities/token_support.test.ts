import { TokenSupport } from './token_support';

describe('TokenSupport utility functions', () => {
    const example = {
        ['SPS']: { token: 'SPS', transferable: true },
        ['SPSP']: { token: 'SPSP', transferable: false },
        ['LICENSE']: { token: 'LICENSE', transferable: true, precision: 0 },
    };

    it.each`
        supported | token
        ${true}   | ${'SPS'}
        ${false}  | ${'SPSP'}
        ${true}   | ${'LICENSE'}
        ${false}  | ${'random-something-else'}
    `(`Checking support for [$token] gives [$supported]`, ({ supported, token }) => {
        expect(TokenSupport.isSupported(example, token)).toBe(supported);
    });

    it.each`
        divisible | token
        ${true}   | ${'SPS'}
        ${true}   | ${'SPSP'}
        ${false}  | ${'LICENSE'}
        ${true}   | ${'random-something-else'}
    `(`Checking division for [$token] gives [$divisible]`, ({ divisible, token }) => {
        expect(TokenSupport.isDivisible(example, token)).toBe(divisible);
    });

    it.each`
        transferable | token                      | amount
        ${true}      | ${'SPS'}                   | ${7}
        ${true}      | ${'SPS'}                   | ${7.2}
        ${true}      | ${'SPS'}                   | ${undefined}
        ${false}     | ${'SPSP'}                  | ${3}
        ${false}     | ${'SPSP'}                  | ${3.34}
        ${false}     | ${'SPSP'}                  | ${undefined}
        ${true}      | ${'LICENSE'}               | ${8}
        ${false}     | ${'LICENSE'}               | ${8.2}
        ${true}      | ${'LICENSE'}               | ${undefined}
        ${false}     | ${'random-something-else'} | ${1}
        ${false}     | ${'random-something-else'} | ${1.1412}
        ${false}     | ${'random-something-else'} | ${undefined}
    `(`Checking transferability for [$amount] of [$token] gives [$transferable]`, ({ transferable, token, amount }) => {
        expect(TokenSupport.canTransfer(example, token, amount)).toBe(transferable);
    });

    describe('TokenSupport.merge', () => {
        it(`Without others just copies`, () => {
            const merged = TokenSupport.merge(example);
            expect(merged).not.toBe(example);
            expect(merged).toMatchObject(example);
        });
        it(`With others just reduces left to right`, () => {
            const merged = TokenSupport.merge(
                example,
                { ['SPS']: { token: 'SPS', transferable: false }, ['LICENSE']: { token: 'LICENSE', transferable: false } },
                { ['LICENSE']: { token: 'LICENSE', transferable: true } },
            );
            expect(merged['SPS']).toMatchObject({ transferable: true });
            expect(merged['LICENSE']).toMatchObject({ transferable: true });
        });
    });

    it('TokenSupport.wrap simply wraps', () => {
        expect(TokenSupport.wrap(example).tokens).toBe(example);
    });
});
