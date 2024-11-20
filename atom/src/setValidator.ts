import { Atom } from './atom';
import { _getState, _setValidator } from './internal-state';
import { AtomConstructorOptions } from './internal-types';
import { throwIfNotAtom } from './throwIfNotAtom';

/**
 * Sets the `validator` for `atom`. `validator` must be a pure function of one argument,
 * which will be passed the intended new state on any state change. If the new state is
 * unacceptable, `validator` should return false or throw an exception. If the current state
 * is not acceptable to the new validator, an exception will be thrown and the validator will
 * not be changed.
 *
 * @param <S> the type of `atom`'s inner state
 *
 * @example
```js

import {Atom, deref, setValidator, set} from '@steem-monsters/atom'
import { _setValidator } from './internal-state';

const atom = Atom.of({ count: 0 }, {validator: (state) => isNumber(state.count) })
setValidator(atom, (state) => isOdd(state.count)) // Error; new validator rejected
set(atom, {count: "not number"}) // Error; new state not set
setValidator(atom, (state) => isEven(state.count)) // All good
set(atom, {count: 2}) // All good

```
 */

export function setValidator<S>(atom: Atom<S>, validator: NonNullable<AtomConstructorOptions<any>['validator']>): void {
    throwIfNotAtom(atom);
    if (!validator(_getState(atom))) {
        const errMsg = `Could not set validator on\n\n${atom}\n\nbecause current state would be invalid according to new validator:\n${validator}\n\n`;
        const err = Error(errMsg);
        err.name = 'AtomInvalidStateError';
        throw err;
    } else {
        _setValidator(atom, validator);
    }
}
