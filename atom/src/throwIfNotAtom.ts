import { Atom } from './atom';
import * as ErrorMsgs from './error-messages';
import { _getState } from './internal-state';
import { prettyPrint } from './prettyPrint';

/** @ignore */
export function throwIfNotAtom<S>(atom: Atom<S>): void | never {
    if (!(atom instanceof Atom)) {
        throw TypeError(`${ErrorMsgs.expectedAtomButGot}\n\n${prettyPrint(atom)}`);
    }
}
