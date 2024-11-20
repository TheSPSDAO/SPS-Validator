import { Atom } from './atom';
import { _dispose } from './internal-state';
import { throwIfNotAtom } from './throwIfNotAtom';

/**
 * Cleans up any resources this atom is using.
 * @param atom
 */
export function dispose<S>(atom: Atom<S>): void {
    throwIfNotAtom(atom);
    _dispose(atom);
}
