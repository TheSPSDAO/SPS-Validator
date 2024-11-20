import { Atom, deref, getValidator, set, setValidator, swap } from '../index';

describe('Atom state validation', () => {
    describe('Atom.of(state, { validator })', () => {
        it("is a predicate function applied to an atom's next state at initialization or swap/set; when validator returns false, then next state is not committed and an error is thrown", () => {
            const a = Atom.of({ a: 'hello' }, { validator: (state) => state.a.length >= 5 });

            expect(() => Atom.of({ a: 'hi' }, { validator: (state) => state.a === 'nope' })).toThrow(); // validates at initialization
            expect(() => Atom.of({ a: 'yep' }, { validator: (state) => state.a === 'yep' })).not.toThrow(); // validates at initialization

            expect(() => swap(a, (s) => ({ ...s, a: s.a.slice(0, 1) }))).toThrow(); // validates at swap
            expect(deref(a)).toEqual({ a: 'hello' });
            expect(() => swap(a, (s) => ({ ...s, a: 'hey there' }))).not.toThrow(); // validates at swap
            expect(deref(a)).toEqual({ a: 'hey there' });

            expect(() => set(a, { a: 'hi' })).toThrow(); // validates at set
            expect(deref(a)).toEqual({ a: 'hey there' });
            expect(() => set(a, { a: 'hidy ho' })).not.toThrow(); // validates at set
            expect(deref(a)).toEqual({ a: 'hidy ho' });
        });

        it('by default is a function that always returns true', () => {
            const a = Atom.of({ a: 'hello' });
            expect(() => set(a, { a: 0 as any })).not.toThrow();
            expect(() => set(a, { a: [] as any })).not.toThrow();
            expect(() => set(a, { a: false as any })).not.toThrow();
        });
    });

    describe('getValidator', () => {
        it('gets the validator function currently set on an atom', () => {
            const validator = (state: number) => state !== null;

            const a = Atom.of(1, { validator });
            expect(getValidator(a)).toBe(validator);
        });
    });

    describe('setValidator', () => {
        it('sets the validator function of an atom', () => {
            const validator = (state: number) => state !== null;

            const a = Atom.of(1);
            setValidator(a, validator);
            expect(getValidator(a)).toBe(validator);
            expect(() => setValidator(a, (state) => state !== 1)).toThrow();
        });

        it('throws an error and does not set the validator if the current state does not pass the validator', () => {
            const a = Atom.of(1);
            const initialValidator = getValidator(a);
            expect(() => setValidator(a, (state) => state !== 1)).toThrow();
            expect(getValidator(a)).toBe(initialValidator);
        });
    });
});
