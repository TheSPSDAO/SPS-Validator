import { Atom, deref, set, swap } from '../index';

describe('Atom instance', () => {
    it('can be instantiated by the static Atom.of method', () => {
        expect(Atom.of(1)).toBeInstanceOf(Atom);
    });

    it('has a readonly public instance member $$id which is a number that acts as its unique ID', () => {
        const a = Atom.of(1);
        const id = a['$$id'];
        expect(typeof id).toBe('number');

        expect(() => {
            (a as any)['$$id'] = 1000e10;
        }).toThrow(TypeError);

        expect(a['$$id']).toBe(id);
    });

    it('implements toString and inspect', () => {
        const a = Atom.of({ a: 'hi' });
        expect(typeof a.toString()).toBe('string');
        expect(typeof a.inspect()).toBe('string');
    });

    describe('options.validator', () => {
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
    });
});
