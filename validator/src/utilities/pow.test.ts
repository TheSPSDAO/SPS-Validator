import { deterministicPow } from './pow';

// Expected values are Math.pow on Node 23.3 x64, the reference implementation. Several differ on
// Node 24+ (std::pow) or on Node 23.3 arm64 by one ulp.
const vectors: ReadonlyArray<[number, number, number]> = [
    [0.99, 32, 0.7249803359578535],
    [0.99, 100, 0.36603234127322914],
    [0.99, 2723, 1.3020716680335496e-12],
    [0.9719, 14, 0.6709685277464601],
    [0.9924, 42, 0.7258447420821864],
    [0.9816, 133, 0.08458534258618253],
    [0.9998, 182, 0.9642510041785703],
    [0.9995, 196, 0.9066266837209989],
    [0.9994, 105, 0.9389257207237007],
    [0.99, 6, 0.9414801494009999],
    [0.99, 0, 1],
    [0.99, 1, 0.99],
    [2, 10, 1024],
    [10, 3, 1000],
    [-2, 3, -8],
    [0.5, -2, 4],
];

describe('deterministicPow', () => {
    test.each(vectors)('%p ** %p', (base, exponent, expected) => {
        expect(Object.is(deterministicPow(base, exponent), expected)).toBe(true);
    });

    test('special values', () => {
        expect(deterministicPow(NaN, 0)).toBe(1);
        expect(deterministicPow(NaN, 1)).toBeNaN();
        expect(deterministicPow(1, Infinity)).toBeNaN();
        expect(deterministicPow(-1, -Infinity)).toBeNaN();
        expect(deterministicPow(0.5, Infinity)).toBe(0);
        expect(deterministicPow(2, -Infinity)).toBe(0);
        expect(deterministicPow(-8, 1 / 3)).toBeNaN();
        expect(Object.is(deterministicPow(-0, 3), -0)).toBe(true);
        expect(deterministicPow(0, -1)).toBe(Infinity);
        expect(deterministicPow(-Infinity, 3)).toBe(-Infinity);
        expect(deterministicPow(2, 1024)).toBe(Infinity);
        expect(deterministicPow(2, -1074)).toBe(5e-324);
    });
});
