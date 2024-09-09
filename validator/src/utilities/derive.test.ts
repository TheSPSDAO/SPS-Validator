import { Atom, set, swap } from '@steem-monsters/atom';
import { Quark } from './derive';

test('Quark sees parent atom changes', () => {
    const atom = Atom.of({ count: 0 });
    const quark = new Quark(atom, 'count');
    expect(quark.deref()).toBe(0);
    set(atom, { count: 33 });
    expect(quark.deref()).toBe(33);
});

test('Quark can have own handler for updates', () => {
    const atom = Atom.of({ count: 0 });
    const quark = new Quark(atom, 'count');
    const mock = { log: (..._args: any[]) => null };
    const logSpy = jest.spyOn(mock, 'log');
    expect(quark.deref()).toBe(0);
    quark.addWatch('hello', (p, n) => {
        mock.log(p, n);
    });
    swap(atom, (s) => ({ count: s.count + 1 }));
    expect(quark.deref()).toBe(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
});

test('Quark handler is ignored for other updates', () => {
    const atom = Atom.of({ count: 0, down: 99 });
    const quark = new Quark(atom, 'count');
    const mock = { log: (..._args: any[]) => null };
    const logSpy = jest.spyOn(mock, 'log');
    expect(quark.deref()).toBe(0);
    quark.addWatch('hello', (p, n) => {
        mock.log(p, n);
    });
    swap(atom, (s) => ({ ...s, down: s.down - 1 }));
    swap(atom, (s) => ({ ...s, down: s.down - 1 }));
    swap(atom, (s) => ({ ...s, count: s.count + 1 }));
    expect(quark.deref()).toBe(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
});
