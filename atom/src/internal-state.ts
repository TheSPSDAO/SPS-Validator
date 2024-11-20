import { Atom } from './atom';
import { AtomConstructorOptions, DeepImmutable } from './internal-types';

let nextAtomUid = 0;
const stateByAtomId: Record<number, DeepImmutable<any>> = Object.create(null);
const validatorByAtomId: Record<number, NonNullable<AtomConstructorOptions<any>['validator']>> = Object.create(null);
const changeHandlersByAtomId: Record<number, Record<string | symbol, (s: any) => void>> = {};

/** @ignore */
export function _useNextAtomId() {
    return nextAtomUid++;
}

/** @ignore */
export function _getState<S>(atom: Atom<S>): S {
    return stateByAtomId[atom['$$id']];
}
/** @ignore */
export function _setState<S>(atom: Atom<S>, state: S): void {
    stateByAtomId[atom['$$id']] = state;
}

/** @ignore */
export function _getValidator<S>(atom: Atom<S>): NonNullable<AtomConstructorOptions<S>['validator']> {
    return validatorByAtomId[atom['$$id']];
}

/** @ignore */
export function _setValidator<S>(atom: Atom<S>, validator: NonNullable<AtomConstructorOptions<S>['validator']>): void {
    validatorByAtomId[atom['$$id']] = validator;
}

/** @ignore */
export function _initChangeHandlerDict(atom: Atom<any>) {
    changeHandlersByAtomId[atom['$$id']] = {};
}

/** @ignore */
export function _addChangeHandler<S>(atom: Atom<S>, key: string | symbol, handler: (states: { previous: S; current: S }) => void) {
    if (typeof changeHandlersByAtomId[atom['$$id']][key] === 'function') {
        throw new Error(`Change handler already registered for key "${String(key)}" on ${atom}.\nRemove the existing handler before registering a new one.`);
    }
    changeHandlersByAtomId[atom['$$id']][key] = handler;
}

/** @ignore */
export function _removeChangeHandler<S>(atom: Atom<S>, key: string | symbol) {
    delete changeHandlersByAtomId[atom['$$id']][key];
}

/** @ignore */
export function _runChangeHandlers<S>(atom: Atom<S>, previous: S, current: S) {
    Object.getOwnPropertySymbols(changeHandlersByAtomId[atom['$$id']]).forEach((k) => {
        if (typeof changeHandlersByAtomId[atom['$$id']][k] === 'function') {
            changeHandlersByAtomId[atom['$$id']][k]({ previous, current });
        }
    });
    Object.keys(changeHandlersByAtomId[atom['$$id']]).forEach((k) => {
        if (typeof changeHandlersByAtomId[atom['$$id']][k] === 'function') {
            changeHandlersByAtomId[atom['$$id']][k]({ previous, current });
        }
    });
}

/** @ignore */
export function _dispose(atom: Atom<any>) {
    delete stateByAtomId[atom['$$id']];
    delete validatorByAtomId[atom['$$id']];
    delete changeHandlersByAtomId[atom['$$id']];
}
