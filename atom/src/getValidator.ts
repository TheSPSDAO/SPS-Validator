import { Atom } from './atom';
import { _getValidator } from './internal-state';
import { AtomConstructorOptions } from './internal-types';

import { throwIfNotAtom } from './throwIfNotAtom';

/**
 * Gets `atom`'s validator function
 *
 * @param <S> the type of `atom`'s inner state
 *
 * @example
```js

import {Atom, deref, getValidator, swap} from '@steem-monsters/atom'

const atom = Atom.of({ count: 0 }, { validator: (state) => isEven(state.count) })
const validator = getValidator(atom)
validator({ count: 3 }) // => false
validator({ count: 2 }) // => true
```
 */

export function getValidator<S>(atom: Atom<S>): NonNullable<AtomConstructorOptions<any>['validator']> {
    throwIfNotAtom(atom);
    return _getValidator(atom);
}
