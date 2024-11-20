import { Atom, deref, swap } from '../index';

describe('swap function', () => {
    it('is a function', () => {
        expect(swap).toBeInstanceOf(Function);
    });

    it("applies the passed-in fn to the Atom's value and sets the Atom's value to the return value", () => {
        const initialState = { count: 0 };
        const nextState = { count: 1 };
        const TEST_ATOM = Atom.of(initialState);
        swap(TEST_ATOM, (s) => nextState);
        expect(deref(TEST_ATOM)).toBe(nextState);
    });

    it('works with multiple atoms; not mixing up their states', () => {
        const a = { nums: [1, 2, 3, 4, 5] };
        const b = 9;
        const c = { hi: 'hello' };
        const TEST_ATOM_A = Atom.of(a);
        const TEST_ATOM_B = Atom.of(b);
        const TEST_ATOM_C = Atom.of(c);
        expect(deref(TEST_ATOM_A)).toBe(a);
        expect(deref(TEST_ATOM_B)).toBe(b);
        expect(deref(TEST_ATOM_C)).toBe(c);

        swap(TEST_ATOM_A, (s) => ({ nums: s.nums.map((n) => n + 1) }));
        const a1 = { nums: [2, 3, 4, 5, 6] };
        expect(deref(TEST_ATOM_A)).toEqual(a1);
        expect(deref(TEST_ATOM_B)).toBe(b);
        expect(deref(TEST_ATOM_C)).toBe(c);

        swap(TEST_ATOM_B, (x) => x + 1);
        const b1 = 10;
        expect(deref(TEST_ATOM_A)).toEqual(a1);
        expect(deref(TEST_ATOM_B)).toEqual(b1);
        expect(deref(TEST_ATOM_C)).toBe(c);

        swap(TEST_ATOM_C, (s) => ({ hi: s.hi.toUpperCase() }));
        const c1 = { hi: 'HELLO' };
        expect(deref(TEST_ATOM_A)).toEqual(a1);
        expect(deref(TEST_ATOM_B)).toEqual(b1);
        expect(deref(TEST_ATOM_C)).toEqual(c1);
    });
});
