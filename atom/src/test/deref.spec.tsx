import * as ErrorMsgs from '../error-messages';
import { Atom, deref } from '../index';

describe('deref', () => {
    it('is a function', () => {
        expect(deref).toBeInstanceOf(Function);
    });

    it('fails when called with anything other than an Atom instance', () => {
        const pojo: unknown = {};
        const arr: unknown = [];
        const num: unknown = 1;
        const str: unknown = 'hello';
        const bool: unknown = true;
        expect(() => deref(pojo as Atom<any>)).toThrow(ErrorMsgs.expectedAtomButGot);
        expect(() => deref(arr as Atom<any>)).toThrow(ErrorMsgs.expectedAtomButGot);
        expect(() => deref(num as Atom<any>)).toThrow(ErrorMsgs.expectedAtomButGot);
        expect(() => deref(str as Atom<any>)).toThrow(ErrorMsgs.expectedAtomButGot);
        expect(() => deref(bool as Atom<any>)).toThrow(ErrorMsgs.expectedAtomButGot);
    });

    it('returns the state of the atom', () => {
        const a1State = { count: 1 };
        const a2State = { size: 1 };
        const a3State = [1];
        const a1 = Atom.of(a1State);
        const a2 = Atom.of(a2State);
        const a3 = Atom.of(a3State);

        expect(deref(a3)).toBe(a3State);
        expect(deref(a1)).toBe(a1State);
        expect(deref(a2)).toBe(a2State);
    });
});
