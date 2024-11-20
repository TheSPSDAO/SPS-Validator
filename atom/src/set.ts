import { Atom } from './atom';
import { deref } from './deref';
import { _getValidator, _runChangeHandlers, _setState } from './internal-state';
import { DeepImmutable } from './internal-types';
import { prettyPrint } from './prettyPrint';
import { throwIfNotAtom } from './throwIfNotAtom';

/**
 * Sets `atom`s state to `nextState`.
 *
 * It is equivalent to `swap(atom, () => newState)`.
 *
 * @param <S> the type of `atom`'s inner state
 * @param atom an instance of [[Atom]]
 * @param nextState the value to which to set the state; it should be the same type/interface as current state
 *
  * @example
```js

import {Atom, deref, set} from '@steem-monsters/atom'

const atom = Atom.of({ count: 0 })

set(atom, { count: 100 })
deref(atom) // => { count: 100 }
```
 */

export function set<S>(atom: Atom<S>, nextState: S): void {
    throwIfNotAtom(atom);
    const validator = _getValidator(atom);
    const didValidate = validator(nextState as DeepImmutable<S>);
    if (!didValidate) {
        const errMsg = `Attempted to set the state of\n\n${atom}\n\nwith:\n\n${prettyPrint(nextState)}\n\nbut it did not pass validator:\n${validator}\n\n`;
        const err = Error(errMsg);
        err.name = 'AtomInvalidStateError';

        throw err;
    } else {
        const prevState = deref(atom);
        _setState(atom, nextState);
        _runChangeHandlers(atom, prevState as S, nextState);
    }
}
