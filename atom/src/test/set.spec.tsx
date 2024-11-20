import { Atom, deref, set } from '../index';

describe('set function', () => {
    it('is a function', () => {
        expect(set).toBeInstanceOf(Function);
    });

    it("sets the Atom's value to the passed-in value", () => {
        const TEST_ATOM = Atom.of({ count: 0 });
        const newState = { count: 1 };
        set(TEST_ATOM, newState);
        expect(deref(TEST_ATOM)).toBe(newState);
    });
});
