import { _getState, _initChangeHandlerDict, _setState, _setValidator, _useNextAtomId } from './internal-state';
import { AtomConstructorOptions, DeepImmutable } from './internal-types';
import { prettyPrint } from './prettyPrint';

/**
 * A data structure useful for providing a controlled, predictable mechanism for mutability.
 * Allows multiple components of a program to share read/write access to some state in such
 * a way that no component can mutate another component's current reference to the state in
 * the middle of some process or asynchronous operation.
 *
 */

export class Atom<S = any> {
    /**
   * Constructs a new instance of [[Atom]] with its internal state
   * set to `state`.
   *
   * @param S the type of the value being set as an [[Atom]]'s internal state
   * @example
```js

import { Atom } from '@steem-monsters/atom'

const a1 = Atom.of(0)
const a2 = Atom.of("zero")
const a3 = Atom.of({ count: 0 })
```
   */
    public static of<S>(state: S, options?: AtomConstructorOptions<S>): Atom<S> {
        return new Atom(state, options);
    }

    /** @ignore */
    // @ts-expect-error - This is a private property
    public readonly ['$$id']: number;

    /** @ignore */
    private constructor(state: S, { validator }: AtomConstructorOptions<S> = {}) {
        validator = validator || (() => true);
        if (!validator(state as DeepImmutable<S>)) {
            const errMsg = `Atom initialized with invalid state:\n\n${prettyPrint(state)}\n\naccording to validator function:\n${validator}\n\n`;
            const err = Error(errMsg);
            err.name = 'AtomInvalidStateError';

            throw err;
        }
        Object.defineProperty(this, '$$id', { value: _useNextAtomId() });
        _setState(this, state);
        _setValidator(this, validator);
        _initChangeHandlerDict(this);
        return this;
    }
    /** @ignore */
    public toString(): string {
        return `Atom<${prettyPrint(_getState(this))}>`;
    }
    /** @ignore */
    public inspect(): string {
        return this.toString();
    }
}
