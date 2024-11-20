import { Atom } from './atom';
import { _getState } from './internal-state';
import { DeepImmutable } from './internal-types';
import { throwIfNotAtom } from './throwIfNotAtom';

/**
 * Dereferences (i.e. "*reads*") the current state of an [[Atom]]. The dereferenced value
 * should ___not___ be mutated.
 *
 * @param <S> the type of `atom`'s inner state
 *
 * @example
```js

import {Atom, deref} from '@steem-monsters/atom'

const stateAtom = Atom.of({ count: 0 })

deref(stateAtom) // => { count: 0 }
```
 */
export function deref<S>(atom: Atom<S>): DeepImmutable<S> {
    throwIfNotAtom(atom);
    return _getState(atom) as DeepImmutable<S>;
}
