// tslint:disable:no-console
import { addChangeHandler, Atom, deref, removeChangeHandler, set, swap } from '../index';

describe('Atom change handlers', function () {
    describe('addChangeHandler', function () {
        it('registers a function that takes named params of `previous` and `current` state that runs on every state change', function () {
            const testAtom = Atom.of(1);
            const mock = { log: (...args: any[]) => null };
            const logSpy = jest.spyOn(mock, 'log');
            addChangeHandler(testAtom, 'print', ({ previous, current }) => {
                expect(previous).not.toBe(current);
                expect(current).toBe(deref(testAtom));
                mock.log(previous, current);
            });
            swap(testAtom, (x) => x + 1);
            set(testAtom, 0);
            swap(testAtom, (x) => x + 1);
            expect(logSpy).toHaveBeenCalledTimes(3);
        });

        it('throws Error when attempting to register a handler on a key that is already in use', function () {
            const testAtom = Atom.of(1);
            const print = () => console.log();
            addChangeHandler(testAtom, 'print', print);
            expect(() => addChangeHandler(testAtom, 'print', print)).toThrow(Error);
        });
    });

    describe('removeChangeHandler', function () {
        it('unregisters the handler function at specified key so that it no longer runs on state change', function () {
            const testAtom = Atom.of(1);
            const mock = { log: (...args: any[]) => null };
            const logSpy = jest.spyOn(mock, 'log');
            addChangeHandler(testAtom, 'print', ({ previous, current }) => {
                expect(previous).not.toBe(current);
                expect(current).toBe(deref(testAtom));
                mock.log(previous, current);
            });
            swap(testAtom, (x) => x + 1);
            removeChangeHandler(testAtom, 'print');
            set(testAtom, 0);
            swap(testAtom, (x) => x + 1);
            expect(logSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('Symbols', function () {
        it('registers a function with a symbol key that takes named params of `previous` and `current` state that runs on every state change ', function () {
            const testAtom = Atom.of(1);
            const mock = { log: (...args: any[]) => null };
            const logSpy = jest.spyOn(mock, 'log');
            addChangeHandler(testAtom, Symbol('print'), ({ previous, current }) => {
                expect(previous).not.toBe(current);
                expect(current).toBe(deref(testAtom));
                mock.log(previous, current);
            });
            swap(testAtom, (x) => x + 1);
            set(testAtom, 0);
            swap(testAtom, (x) => x + 1);
            expect(logSpy).toHaveBeenCalledTimes(3);
        });

        it('unregisters the handler function at specified symbol key so that it no longer runs on state change', function () {
            const testAtom = Atom.of(1);
            const mock = { log: (...args: any[]) => null };
            const logSpy = jest.spyOn(mock, 'log');
            const sym = Symbol('print');
            addChangeHandler(testAtom, sym, ({ previous, current }) => {
                expect(previous).not.toBe(current);
                expect(current).toBe(deref(testAtom));
                mock.log(previous, current);
            });
            swap(testAtom, (x) => x + 1);
            removeChangeHandler(testAtom, sym);
            set(testAtom, 0);
            swap(testAtom, (x) => x + 1);
            expect(logSpy).toHaveBeenCalledTimes(1);
        });

        it('register a function with similar but distinct symbol key that takes named params of `previous` and `current` state that runs on every state change', function () {
            const testAtom = Atom.of(1);
            const mock = { log: (...args: any[]) => null };
            const logSpy = jest.spyOn(mock, 'log');
            const handler = ({ previous, current }: { previous: number; current: number }) => {
                expect(previous).not.toBe(current);
                expect(current).toBe(deref(testAtom));
                mock.log(previous, current);
            };
            addChangeHandler(testAtom, Symbol('print'), handler);
            swap(testAtom, (x) => x + 1);
            expect(logSpy).toHaveBeenCalledTimes(1);
            addChangeHandler(testAtom, Symbol('print'), handler);
            set(testAtom, 0);
            swap(testAtom, (x) => x + 1);
            expect(logSpy).toHaveBeenCalledTimes(5);
        });
    });

    describe('Integration: addChangeHandler & removeChangehandler', function () {
        describe('Handlers removed by upstream handlers', function () {
            it('allows prior handlers to remove later handlers without causing undefinded-is-not-a-function errors', function () {
                const testAtom = Atom.of({ count: 0 });
                addChangeHandler(testAtom, 'handler1', () => {
                    removeChangeHandler(testAtom, 'handler2');
                });
                addChangeHandler(testAtom, 'handler2', () => {
                    removeChangeHandler(testAtom, 'handler1');
                });

                expect(() => swap(testAtom, (s) => ({ count: s.count + 1 }))).not.toThrowError(/not a function/);
            });

            it('does not run handlers removed by earlier handlers', function () {
                const nooper = { noop: () => null };
                const noopSpy = jest.spyOn(nooper, 'noop');
                const testAtom = Atom.of({ count: 0 });
                addChangeHandler(testAtom, 'handler1', () => {
                    removeChangeHandler(testAtom, 'handler2');
                });

                addChangeHandler(testAtom, 'handler2', () => {
                    nooper.noop();
                    removeChangeHandler(testAtom, 'handler1');
                });

                swap(testAtom, (s) => ({ count: s.count + 1 }));
                expect(noopSpy).toHaveBeenCalledTimes(0);
            });
        });
    });
});
