import { Atom } from './atom';
import { _addChangeHandler, _removeChangeHandler } from './internal-state';

/**
 * Registers a function to be run each time the state of `atom` changes.
 *
 * Will throw an Error if `key` is already taken by another handler.
 *
 * @example
```js

import {Atom, addChangeHandler, swap} from '@steem-monsters/atom'

const countAtom = Atom.of({ count: 0 })

addChangeHandler(countAtom, "log", ({current, previous}) => {
  console.log(previous, current)
})

swap(countAtom, (state) => ({ count: state.count + 1 }))


// stdout logs:
// { count: 0 }
// { count: 1 }

```
 */
export function addChangeHandler<S>(atom: Atom<S>, key: string | symbol, handler: (states: { previous: S; current: S }) => void) {
    _addChangeHandler(atom, key, handler);
}

/**
 * Deletes the `key` and the handler associated with `key` so that it not longer runs
 * when the state of `atom` changes.
 *
 * @example
```js

import {Atom, addChangeHandler, removeChangeHandler, swap} from '@steem-monsters/atom'

const countAtom = Atom.of({ count: 0 })

addChangeHandler(countAtom, "log", ({current, previous}) => {
  console.log(previous, current)
})

swap(countAtom, (state) => ({ count: state.count + 1 }))

// stdout logs:
// { count: 0 }
// { count: 1 }

removeChangeHandler(atom, "log")

swap(countAtom, (state) => ({ count: state.count + 1 }))

// nothing is logged
```
 */
export function removeChangeHandler<S>(atom: Atom<S>, key: string | symbol) {
    _removeChangeHandler(atom, key);
}
