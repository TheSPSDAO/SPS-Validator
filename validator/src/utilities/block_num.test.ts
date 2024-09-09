import { coerceToBlockNum } from './block_num';

describe('Utility functions', () => {
    it.each`
        value        | n
        ${0}         | ${null}
        ${7}         | ${7}
        ${11.8}      | ${11}
        ${0x80}      | ${128}
        ${-3.14}     | ${null}
        ${'49'}      | ${49}
        ${'0x80'}    | ${null}
        ${'-780'}    | ${null}
        ${'9.9'}     | ${9}
        ${'HEAD'}    | ${null}
        ${'apricot'} | ${null}
        ${Infinity}  | ${null}
        ${-Infinity} | ${null}
        ${NaN}       | ${null}
        ${null}      | ${null}
        ${undefined} | ${null}
    `(`Coercing [$value] to block number gives [$n]`, ({ value, n }) => {
        expect(coerceToBlockNum(value)).toBe(n);
    });
});
